import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { withRls } from "@/lib/db/rls";
import { caseAssignments, customers, orderItems, serviceCases } from "@/lib/db/schema";

/**
 * The signed-in technician's current jobs. RLS limits cases to ones where they are an ACTIVE
 * participant, so reassigned or declined jobs disappear (spec §3: technicians see only
 * cases assigned to them).
 */
export async function listMyJobs(authUserId: string, technicianId: string) {
  return withRls(authUserId, (tx) =>
    tx
      .select({
        caseId: serviceCases.id,
        caseNumber: serviceCases.caseNumber,
        status: serviceCases.status,
        priority: serviceCases.priority,
        title: serviceCases.title,
        productName: orderItems.name,
        customerName: customers.name,
        address: serviceCases.serviceAddress,
        assignmentStatus: caseAssignments.assignmentStatus,
        scheduledAt: caseAssignments.scheduledAt,
        assignedAt: caseAssignments.createdAt,
      })
      .from(caseAssignments)
      .innerJoin(serviceCases, eq(serviceCases.id, caseAssignments.caseId))
      .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
      .innerJoin(customers, eq(customers.id, serviceCases.customerId))
      .where(and(eq(caseAssignments.technicianId, technicianId), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted", "completed"])))
      .orderBy(asc(caseAssignments.scheduledAt), desc(caseAssignments.createdAt)),
  );
}
export type Job = Awaited<ReturnType<typeof listMyJobs>>[number];
