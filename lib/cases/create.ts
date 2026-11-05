import "server-only";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { Actor } from "@/lib/auth/session";
import { db, type Tx } from "@/lib/db/client";
import {
  caseCounters,
  caseEvents,
  caseParticipants,
  chatThreads,
  orderItems,
  orders,
  organizationMemberships,
  serviceCases,
  warranties,
} from "@/lib/db/schema";
import type { CreateCaseInput, CreateCaseResult } from "@/lib/contracts/cases";
import { HttpError, notFound } from "@/lib/http";
import { enqueue } from "@/lib/jobs/queue";
import { ensureNexconnId } from "@/lib/nexconn/ids";
import { categoryLabel } from "./categories";
import { TERMINAL } from "./state-machine";

/** Atomic, gap-free per organisation and year: RC-2026-0042. */
export async function nextCaseNumber(tx: Tx, organizationId: string, year = new Date().getUTCFullYear()) {
  const [row] = await tx
    .insert(caseCounters)
    .values({ organizationId, year, lastValue: 1 })
    .onConflictDoUpdate({
      target: [caseCounters.organizationId, caseCounters.year],
      set: { lastValue: sql`${caseCounters.lastValue} + 1` },
    })
    .returning({ n: caseCounters.lastValue });
  return `RC-${year}-${String(row.n).padStart(4, "0")}`;
}

/** Active support agent with the fewest open cases (spec Journey B step 11). */
async function pickAgent(organizationId: string): Promise<string | null> {
  const rows = await db
    .select({
      userId: organizationMemberships.userId,
      open: sql<number>`(
        select count(*) from ${serviceCases} c
        where c.assigned_agent_id = ${organizationMemberships.userId}
          and c.status not in ('closed', 'rejected', 'cancelled')
      )`.mapWith(Number),
    })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.role, "support_agent"),
        eq(organizationMemberships.isActive, true),
      ),
    );
  rows.sort((a, b) => a.open - b.open);
  return rows[0]?.userId ?? null;
}

/**
 * Customer reports a fault (spec Journey B). Ownership is proven by the verified-email link
 * between this user and the order's customer record; an order id alone is never trusted.
 */
export async function createCase(actor: Actor, input: CreateCaseInput): Promise<CreateCaseResult> {
  const [item] = await db
    .select({
      itemId: orderItems.id,
      itemName: orderItems.name,
      serial: orderItems.serialNumber,
      orderId: orders.id,
      organizationId: orders.organizationId,
      customerId: orders.customerId,
      shippingAddress: orders.shippingAddress,
      warrantyStatus: warranties.verificationStatus,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(warranties, eq(warranties.orderItemId, orderItems.id))
    .where(eq(orderItems.id, input.orderItemId));
  if (!item || !actor.customerIds.includes(item.customerId)) throw notFound("Purchase not found");

  // One open case per purchased item: send the customer to the case they already have.
  const [open] = await db
    .select({ id: serviceCases.id, caseNumber: serviceCases.caseNumber })
    .from(serviceCases)
    .where(and(eq(serviceCases.orderItemId, item.itemId), notInArray(serviceCases.status, TERMINAL)));
  if (open) throw new HttpError(409, `You already have an open case for this product (${open.caseNumber}).`, open.id);

  // Agent choice and chat identities happen before the transaction (each is idempotent).
  const agentId = await pickAgent(item.organizationId);
  const customerNexconnId = await ensureNexconnId(actor.user.id);
  const agentNexconnId = agentId ? await ensureNexconnId(agentId) : null;

  return db.transaction(async (tx) => {
    const caseNumber = await nextCaseNumber(tx, item.organizationId);
    const [kase] = await tx
      .insert(serviceCases)
      .values({
        organizationId: item.organizationId,
        caseNumber,
        customerId: item.customerId,
        orderId: item.orderId,
        orderItemId: item.itemId,
        category: input.category,
        title: `${categoryLabel(input.category)}: ${item.itemName}`,
        description: input.description,
        troubleshooting: input.troubleshooting,
        reportedSerial: input.serialNumber || item.serial,
        warrantyStatus: item.warrantyStatus ?? "unverified",
        assignedAgentId: agentId,
        currentOwnerId: agentId,
        serviceAddress: item.shippingAddress,
      })
      .returning({ id: serviceCases.id });

    await tx.insert(caseParticipants).values([
      { caseId: kase.id, userId: actor.user.id, participantRole: "customer" as const },
      ...(agentId ? [{ caseId: kase.id, userId: agentId, participantRole: "support_agent" as const }] : []),
    ]);

    // Spec §9: assign an agent before the first direct conversation so it has a clear owner.
    if (agentNexconnId) {
      await tx.insert(chatThreads).values({ caseId: kase.id, threadType: "direct", customerNexconnId, agentNexconnId });
    }

    await tx.insert(caseEvents).values({
      caseId: kase.id,
      actorId: actor.user.id,
      eventType: "case_created",
      newStatus: "submitted",
      metadata: { category: input.category, agentId },
    });
    await enqueue("case.notify", { caseId: kase.id, kind: "case_created" }, { tx });
    return { caseId: kase.id, caseNumber };
  });
}

