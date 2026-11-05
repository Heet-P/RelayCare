import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { categoryLabel } from "@/lib/cases/categories";
import { HandoffInput, type HandoffV1 } from "@/lib/cases/handoff";
import { transitionCase } from "@/lib/cases/transitions";
import { db } from "@/lib/db/client";
import { caseAttachments, caseEvents, caseHandoffs, customers, orderItems, orders, serviceCases, users, warranties } from "@/lib/db/schema";
import { date } from "@/lib/format";
import { handle, HttpError } from "@/lib/http";

const WARRANTY_TEXT: Record<string, string> = {
  eligible: "Verified by merchant: covered",
  exception: "Covered as an exception (approved by merchant)",
  expired: "Expired",
  not_covered: "Not covered",
  pending: "Being checked",
  unverified: "Not yet verified",
};

/**
 * POST /api/cases/:id/handoff — spec Journey C step 9. The agent supplies symptoms, what was
 * tried and the required action; the server adds the order, product, customer and warranty
 * facts it already holds, so the snapshot is complete and cannot be forged from the browser.
 * With `sendToDispatch`, the case moves to awaiting_assignment in the same transaction.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/handoff">) => {
  const { id } = await ctx.params;
  const access = await requireCaseAccess(id, ["owner", "support_agent"]);
  const input = HandoffInput.parse(await req.json());
  const { kase, actor } = access;

  const [facts] = await db
    .select({
      orderNumber: orders.orderNumber,
      orderedAt: orders.orderedAt,
      product: orderItems.name,
      serial: orderItems.serialNumber,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      address: serviceCases.serviceAddress,
      warrantyExpires: warranties.expiresAt,
      language: users.locale,
    })
    .from(serviceCases)
    .innerJoin(orders, eq(orders.id, serviceCases.orderId))
    .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
    .innerJoin(customers, eq(customers.id, serviceCases.customerId))
    .leftJoin(users, eq(users.id, customers.userId))
    .leftJoin(warranties, eq(warranties.orderItemId, serviceCases.orderItemId))
    .where(eq(serviceCases.id, kase.id));

  // Evidence must belong to this case; ids from the browser are only a selection.
  const evidence = input.attachmentIds.length
    ? await db
        .select({ id: caseAttachments.id, fileName: caseAttachments.fileName })
        .from(caseAttachments)
        .where(and(eq(caseAttachments.caseId, kase.id), inArray(caseAttachments.id, input.attachmentIds)))
    : [];
  if (evidence.length !== input.attachmentIds.length) throw new HttpError(400, "Some selected files do not belong to this case.", "bad_attachment");

  const a = facts.address;
  const snapshot: HandoffV1 = {
    version: 1,
    case: kase.caseNumber,
    product: facts.product,
    serialNumber: kase.reportedSerial ?? facts.serial,
    order: { number: facts.orderNumber, purchasedAt: facts.orderedAt?.toISOString() ?? null },
    customer: {
      name: facts.customerName,
      phone: facts.customerPhone ?? a?.phone ?? null,
      email: facts.customerEmail,
      address: a ? [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ") : null,
      language: facts.language ?? "en",
    },
    issue: categoryLabel(kase.category),
    complaint: kase.description,
    symptoms: input.symptoms,
    troubleshooting: input.troubleshooting,
    warranty: `${WARRANTY_TEXT[kase.warrantyStatus] ?? kase.warrantyStatus}${facts.warrantyExpires && ["eligible", "exception"].includes(kase.warrantyStatus) ? ` until ${date(facts.warrantyExpires)}` : ""}`,
    actionRequired: input.actionRequired,
    priority: input.priority,
    evidence,
    notes: input.notes ?? null,
    preparedBy: actor.user.name,
    preparedAt: new Date().toISOString(),
  };

  const result = await db.transaction(async (tx) => {
    const [handoff] = await tx
      .insert(caseHandoffs)
      .values({ caseId: kase.id, fromUserId: actor.user.id, toUserId: null, contextSnapshot: snapshot })
      .returning({ id: caseHandoffs.id });
    if (input.priority !== kase.priority) await tx.update(serviceCases).set({ priority: input.priority }).where(eq(serviceCases.id, kase.id));
    await tx.insert(caseEvents).values({ caseId: kase.id, actorId: actor.user.id, eventType: "handoff_created", metadata: { handoffId: handoff.id, to: "dispatch" } });
    const moved = input.sendToDispatch ? await transitionCase(access, { to: "awaiting_assignment" }, tx) : null;
    return { handoffId: handoff.id, status: moved?.status ?? kase.status };
  });
  return NextResponse.json(result, { status: 201 });
});
