import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CaseStatus } from "@/lib/cases/state-machine";
import { withRls } from "@/lib/db/rls";
import { caseEvents, customers, orderItems, serviceCases, users } from "@/lib/db/schema";

const owner = alias(users, "owner");
const actor = alias(users, "actor");

/** Status groups used by the overview stats and the case list filters. */
export const STATUS_GROUPS = {
  open: ["submitted", "under_triage", "warranty_review", "awaiting_assignment", "assigned", "scheduled", "in_progress", "resolution_pending", "awaiting_customer", "escalated", "reopened"],
  triage: ["submitted", "under_triage", "warranty_review", "reopened", "escalated"],
  dispatch: ["awaiting_assignment"],
  customer: ["awaiting_customer", "resolution_pending"],
  field: ["assigned", "scheduled", "in_progress"],
  done: ["resolved", "closed", "rejected", "cancelled"],
} satisfies Record<string, CaseStatus[]>;
export type StatusGroup = keyof typeof STATUS_GROUPS;

const PRIORITY_ORDER = sql`case ${serviceCases.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`;

const caseRow = {
  id: serviceCases.id,
  caseNumber: serviceCases.caseNumber,
  title: serviceCases.title,
  status: serviceCases.status,
  priority: serviceCases.priority,
  createdAt: serviceCases.createdAt,
  updatedAt: serviceCases.updatedAt,
  productName: orderItems.name,
  customerName: customers.name,
  ownerName: owner.name,
};

/** Spec §4A dashboard numbers. */
export async function overviewStats(authUserId: string) {
  return withRls(authUserId, async (tx) => {
    const [row] = await tx
      .select({
        open: sql<number>`count(*) filter (where ${inArray(serviceCases.status, STATUS_GROUPS.open)})`.mapWith(Number),
        awaitingAssignment: sql<number>`count(*) filter (where ${serviceCases.status} = 'awaiting_assignment')`.mapWith(Number),
        awaitingCustomer: sql<number>`count(*) filter (where ${serviceCases.status} = 'awaiting_customer')`.mapWith(Number),
        inProgress: sql<number>`count(*) filter (where ${inArray(serviceCases.status, STATUS_GROUPS.field)})`.mapWith(Number),
        pendingResolution: sql<number>`count(*) filter (where ${serviceCases.status} = 'resolution_pending')`.mapWith(Number),
        avgResolutionHours: sql<number | null>`round(extract(epoch from avg(${serviceCases.resolvedAt} - ${serviceCases.createdAt})) / 3600, 1)`.mapWith((v) => (v == null ? null : Number(v))),
      })
      .from(serviceCases);
    return row;
  });
}

/**
 * "The most important dashboard element" (spec §4A): what needs a staff decision now,
 * most urgent and oldest first.
 */
export async function needsAttention(authUserId: string, limit = 12) {
  return withRls(authUserId, (tx) =>
    tx
      .select(caseRow)
      .from(serviceCases)
      .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
      .innerJoin(customers, eq(customers.id, serviceCases.customerId))
      .leftJoin(owner, eq(owner.id, serviceCases.currentOwnerId))
      .where(inArray(serviceCases.status, [...STATUS_GROUPS.triage, ...STATUS_GROUPS.dispatch]))
      .orderBy(PRIORITY_ORDER, asc(serviceCases.createdAt))
      .limit(limit),
  );
}

export async function recentActivity(authUserId: string, limit = 10) {
  return withRls(authUserId, (tx) =>
    tx
      .select({
        id: caseEvents.id,
        caseId: caseEvents.caseId,
        caseNumber: serviceCases.caseNumber,
        eventType: caseEvents.eventType,
        newStatus: caseEvents.newStatus,
        metadata: caseEvents.metadata,
        createdAt: caseEvents.createdAt,
        actorName: actor.name,
      })
      .from(caseEvents)
      .innerJoin(serviceCases, eq(serviceCases.id, caseEvents.caseId))
      .leftJoin(actor, eq(actor.id, caseEvents.actorId))
      .orderBy(desc(caseEvents.createdAt))
      .limit(limit),
  );
}

export async function listCases(authUserId: string, opts: { group?: StatusGroup | "all"; q?: string; mine?: string }) {
  return withRls(authUserId, (tx) => {
    const filters: SQL[] = [];
    if (opts.group && opts.group !== "all") filters.push(inArray(serviceCases.status, STATUS_GROUPS[opts.group]));
    if (opts.mine) filters.push(eq(serviceCases.currentOwnerId, opts.mine));
    const q = opts.q?.trim();
    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      filters.push(or(ilike(serviceCases.caseNumber, like), ilike(customers.name, like), ilike(customers.email, like), ilike(orderItems.name, like), ilike(serviceCases.reportedSerial, like))!);
    }
    return tx
      .select(caseRow)
      .from(serviceCases)
      .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
      .innerJoin(customers, eq(customers.id, serviceCases.customerId))
      .leftJoin(owner, eq(owner.id, serviceCases.currentOwnerId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(PRIORITY_ORDER, desc(serviceCases.updatedAt))
      .limit(200);
  });
}
export type CaseRow = Awaited<ReturnType<typeof listCases>>[number];
