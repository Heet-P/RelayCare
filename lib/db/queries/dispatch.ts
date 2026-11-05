import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { openJobsSql } from "@/lib/cases/assign";
import type { CaseStatus } from "@/lib/cases/state-machine";
import { db } from "@/lib/db/client";
import { withRls } from "@/lib/db/rls";
import { caseAssignments, customers, orderItems, organizationMemberships, serviceCases, servicePartners, technicianProfiles, users } from "@/lib/db/schema";

const tech = alias(users, "tech");

export const DISPATCH_VIEWS = {
  queue: { label: "Needs technician", statuses: ["awaiting_assignment"] },
  field: { label: "Booked and in progress", statuses: ["assigned", "scheduled", "in_progress"] },
  escalated: { label: "Escalated", statuses: ["escalated", "reopened"] },
  open: {
    label: "All unresolved",
    statuses: ["submitted", "under_triage", "warranty_review", "awaiting_assignment", "assigned", "scheduled", "in_progress", "resolution_pending", "awaiting_customer", "escalated", "reopened"],
  },
} satisfies Record<string, { label: string; statuses: CaseStatus[] }>;
export type DispatchView = keyof typeof DISPATCH_VIEWS;

/** Spec §4C: case, product, customer, priority, technician, status, appointment. Under RLS. */
export async function listDispatch(authUserId: string, view: DispatchView) {
  return withRls(authUserId, (tx) =>
    tx
      .select({
        id: serviceCases.id,
        caseNumber: serviceCases.caseNumber,
        status: serviceCases.status,
        priority: serviceCases.priority,
        createdAt: serviceCases.createdAt,
        productName: orderItems.name,
        customerName: customers.name,
        city: sql<string | null>`${serviceCases.serviceAddress}->>'city'`,
        technicianId: tech.id,
        technicianName: tech.name,
        assignmentStatus: caseAssignments.assignmentStatus,
        scheduledAt: caseAssignments.scheduledAt,
      })
      .from(serviceCases)
      .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
      .innerJoin(customers, eq(customers.id, serviceCases.customerId))
      .leftJoin(caseAssignments, and(eq(caseAssignments.caseId, serviceCases.id), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted"])))
      .leftJoin(tech, eq(tech.id, caseAssignments.technicianId))
      .where(inArray(serviceCases.status, DISPATCH_VIEWS[view].statuses))
      .orderBy(
        sql`case ${serviceCases.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`,
        asc(caseAssignments.scheduledAt),
        asc(serviceCases.createdAt),
      ),
  );
}
export type DispatchRow = Awaited<ReturnType<typeof listDispatch>>[number];

/** Technicians the dispatcher can choose from, with partner, areas and current workload. */
export async function listTechnicians(organizationId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      partnerId: servicePartners.id,
      partnerName: servicePartners.name,
      serviceAreas: technicianProfiles.serviceAreas,
      isAvailable: sql<boolean>`coalesce(${technicianProfiles.isAvailable}, true)`,
      openJobs: openJobsSql,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .leftJoin(technicianProfiles, and(eq(technicianProfiles.userId, users.id), eq(technicianProfiles.organizationId, organizationId)))
    .leftJoin(servicePartners, eq(servicePartners.id, technicianProfiles.servicePartnerId))
    .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.role, "technician"), eq(organizationMemberships.isActive, true)))
    .orderBy(asc(users.name));
}
export type TechnicianOption = Awaited<ReturnType<typeof listTechnicians>>[number];
