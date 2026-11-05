import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withRls } from "@/lib/db/rls";
import {
  caseAssignments,
  caseAttachments,
  caseEvents,
  caseParticipants,
  caseHandoffs,
  chatThreads,
  customers,
  orderItems,
  orders,
  serviceCases,
  users,
  warranties,
} from "@/lib/db/schema";

const agent = alias(users, "agent");

/**
 * Everything a case page needs, read under RLS as the viewer (customer, staff or technician).
 * Returns null when the viewer cannot see the case. Staff-only attachments are filtered by RLS.
 */
export async function getCaseView(authUserId: string, caseId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return null;
  return withRls(authUserId, async (tx) => {
    const [kase] = await tx
      .select({
        case: serviceCases,
        order: { id: orders.id, orderNumber: orders.orderNumber, orderedAt: orders.orderedAt, completedAt: orders.completedAt, total: orders.total, currency: orders.currency },
        item: { id: orderItems.id, name: orderItems.name, sku: orderItems.sku, serialNumber: orderItems.serialNumber },
        warranty: { status: warranties.verificationStatus, startsAt: warranties.startsAt, expiresAt: warranties.expiresAt, notes: warranties.notes },
        customer: { id: customers.id, name: customers.name, email: customers.email, phone: customers.phone },
        agent: { id: agent.id, name: agent.name, nexconnUserId: agent.nexconnUserId },
      })
      .from(serviceCases)
      .innerJoin(orders, eq(orders.id, serviceCases.orderId))
      .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
      .innerJoin(customers, eq(customers.id, serviceCases.customerId))
      .leftJoin(warranties, eq(warranties.orderItemId, orderItems.id))
      .leftJoin(agent, eq(agent.id, serviceCases.assignedAgentId))
      .where(eq(serviceCases.id, caseId));
    if (!kase) return null;

    const [attachments, events, threads, assignments, handoffs, participants] = await Promise.all([
      tx.select().from(caseAttachments).where(eq(caseAttachments.caseId, caseId)).orderBy(asc(caseAttachments.createdAt)),
      tx.select().from(caseEvents).where(eq(caseEvents.caseId, caseId)).orderBy(asc(caseEvents.createdAt)),
      tx.select().from(chatThreads).where(eq(chatThreads.caseId, caseId)).orderBy(asc(chatThreads.createdAt)),
      tx.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseId)).orderBy(desc(caseAssignments.createdAt)),
      tx.select().from(caseHandoffs).where(eq(caseHandoffs.caseId, caseId)).orderBy(desc(caseHandoffs.createdAt)),
      tx
        .select({
          userId: caseParticipants.userId,
          role: caseParticipants.participantRole,
          removedAt: caseParticipants.removedAt,
          name: users.name,
          nexconnUserId: users.nexconnUserId,
        })
        .from(caseParticipants)
        .innerJoin(users, eq(users.id, caseParticipants.userId))
        .where(eq(caseParticipants.caseId, caseId)),
    ]);

    // Display names for everyone referenced on the page (actors, uploaders, technicians).
    const ids = [
      ...new Set([
        ...events.map((e) => e.actorId),
        ...attachments.map((a) => a.uploadedBy),
        ...assignments.flatMap((a) => [a.technicianId, a.assignedBy]),
      ].filter(Boolean) as string[]),
    ];
    const people = ids.length
      ? await tx.select({ id: users.id, name: users.name, nexconnUserId: users.nexconnUserId }).from(users).where(inArray(users.id, ids))
      : [];

    const active = assignments.find((a) => a.assignmentStatus === "assigned" || a.assignmentStatus === "accepted") ?? null;
    return {
      ...kase,
      attachments,
      events,
      threads,
      assignments,
      handoffs,
      participants,
      activeAssignment: active,
      technician: active ? people.find((p) => p.id === active.technicianId) ?? null : null,
      people: Object.fromEntries(people.map((p) => [p.id, p])),
    };
  });
}
export type CaseView = NonNullable<Awaited<ReturnType<typeof getCaseView>>>;
