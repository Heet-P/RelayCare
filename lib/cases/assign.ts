import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { CaseAccess } from "@/lib/auth/access";
import { db, type Tx } from "@/lib/db/client";
import {
  caseAssignments,
  caseEvents,
  caseHandoffs,
  caseParticipants,
  organizationMemberships,
  serviceCases,
  technicianProfiles,
  users,
} from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { enqueue } from "@/lib/jobs/queue";
import { transitionCase } from "./transitions";

export type AssignInput = { technicianId: string; servicePartnerId?: string; scheduledAt?: Date; note?: string; reassign?: boolean };

/** Add or re-activate a participant (removed participants lose access until re-added). */
export async function addParticipant(tx: Tx, caseId: string, userId: string, role: "technician" | "dispatcher" | "support_agent" | "owner") {
  await tx
    .insert(caseParticipants)
    .values({ caseId, userId, participantRole: role })
    .onConflictDoUpdate({ target: [caseParticipants.caseId, caseParticipants.userId], set: { removedAt: null, participantRole: role, joinedAt: new Date() } });
}

export async function removeParticipant(tx: Tx, caseId: string, userId: string) {
  await tx
    .update(caseParticipants)
    .set({ removedAt: new Date() })
    .where(and(eq(caseParticipants.caseId, caseId), eq(caseParticipants.userId, userId), isNull(caseParticipants.removedAt)));
}

/**
 * Assign (or reassign) a technician — spec Journey D. The ONLY writer of case_assignments.
 * In one transaction: cancel the previous assignment (history is kept), remove the old
 * technician's access, add the new technician and the dispatcher as participants, hand the
 * latest handoff to the technician, move the case to `assigned` (or `scheduled`), and log it.
 * The Nexconn group is synced afterwards by a retryable job.
 */
export async function assignTechnician(access: CaseAccess, input: AssignInput) {
  const { kase, actor } = access;
  const [tech] = await db
    .select({ id: users.id, name: users.name, available: technicianProfiles.isAvailable })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .leftJoin(technicianProfiles, and(eq(technicianProfiles.userId, users.id), eq(technicianProfiles.organizationId, kase.organizationId)))
    .where(
      and(
        eq(organizationMemberships.organizationId, kase.organizationId),
        eq(organizationMemberships.userId, input.technicianId),
        eq(organizationMemberships.role, "technician"),
        eq(organizationMemberships.isActive, true),
      ),
    );
  if (!tech) throw new HttpError(400, "Choose an active technician from your team.", "bad_technician");

  const result = await db.transaction(async (tx) => {
    // Serialise concurrent assign requests for this case on the case row.
    await tx.select({ id: serviceCases.id }).from(serviceCases).where(eq(serviceCases.id, kase.id)).for("update");
    const [previous] = await tx
      .select()
      .from(caseAssignments)
      .where(and(eq(caseAssignments.caseId, kase.id), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted"])))
      .for("update");
    if (previous?.technicianId === tech.id) throw new HttpError(409, `${tech.name} is already assigned to this case.`, "already_assigned");
    if (previous && !input.reassign) {
      // A double click or a stale screen must not silently swap technicians.
      throw new HttpError(409, "A technician is already assigned. Use Change technician to replace them.", "already_assigned");
    }

    // Reassignment: the case goes back to the queue first, so the audit trail shows both steps.
    if (previous) {
      await tx
        .update(caseAssignments)
        .set({ assignmentStatus: "cancelled", note: input.note ?? `Reassigned to ${tech.name}` })
        .where(eq(caseAssignments.id, previous.id));
      await removeParticipant(tx, kase.id, previous.technicianId);
      await transitionCase(access, { to: "awaiting_assignment", reason: input.note ?? `Reassigned to ${tech.name}` }, tx);
    }

    const [assignment] = await tx
      .insert(caseAssignments)
      .values({
        caseId: kase.id,
        technicianId: tech.id,
        servicePartnerId: input.servicePartnerId,
        assignedBy: actor.user.id,
        scheduledAt: input.scheduledAt,
      })
      .returning();
    await addParticipant(tx, kase.id, tech.id, "technician");
    await addParticipant(tx, kase.id, actor.user.id, access.role === "owner" ? "owner" : "dispatcher");

    // The technician receives the same structured context the agent prepared (spec §9 handoff).
    const [latest] = await tx.select().from(caseHandoffs).where(eq(caseHandoffs.caseId, kase.id)).orderBy(desc(caseHandoffs.createdAt)).limit(1);
    if (latest) {
      await tx.insert(caseHandoffs).values({ caseId: kase.id, fromUserId: actor.user.id, toUserId: tech.id, contextSnapshot: latest.contextSnapshot });
    }

    await transitionCase(access, { to: "assigned" }, tx);
    await tx.insert(caseEvents).values({
      caseId: kase.id,
      actorId: actor.user.id,
      eventType: "technician_assigned",
      metadata: { technicianId: tech.id, technicianName: tech.name, previousTechnicianId: previous?.technicianId ?? null, scheduledAt: input.scheduledAt?.toISOString() ?? null },
    });
    if (input.scheduledAt) await transitionCase(access, { to: "scheduled" }, tx);

    await enqueue("nexconn.group.sync", { caseId: kase.id, assignmentId: assignment.id }, { tx, dedupeKey: `group.sync:${assignment.id}` });
    return { assignmentId: assignment.id, technician: tech.name };
  });
  return result;
}

/** Open jobs per technician, for the assign dialog workload hint. Outer row referenced literally (see loadActorRows). */
export const openJobsSql = sql<number>`(
  select count(*) from ${caseAssignments} a
  where a.technician_id = "users"."id" and a.assignment_status in ('assigned', 'accepted')
)`.mapWith(Number);

async function activeAssignment(tx: Tx, caseId: string) {
  const [a] = await tx
    .select()
    .from(caseAssignments)
    .where(and(eq(caseAssignments.caseId, caseId), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted"])))
    .for("update");
  return a ?? null;
}

/** Book or move the visit. Dispatch, or the assigned technician themselves. */
export async function scheduleVisit(access: CaseAccess, scheduledAt: Date, outer?: Tx) {
  const run = async (tx: Tx) => {
    const a = await activeAssignment(tx, access.kase.id);
    if (!a) throw new HttpError(409, "Assign a technician before booking a visit.", "no_assignment");
    if (access.role === "technician" && a.technicianId !== access.actor.user.id) throw new HttpError(403, "This job is not yours.", "forbidden");
    await tx.update(caseAssignments).set({ scheduledAt }).where(eq(caseAssignments.id, a.id));
    await tx.insert(caseEvents).values({
      caseId: access.kase.id,
      actorId: access.actor.user.id,
      eventType: "visit_scheduled",
      metadata: { scheduledAt: scheduledAt.toISOString(), rescheduled: !!a.scheduledAt },
    });
    const [now] = await tx.select({ status: serviceCases.status }).from(serviceCases).where(eq(serviceCases.id, access.kase.id));
    if (now.status === "assigned") await transitionCase(access, { to: "scheduled" }, tx);
  };
  return outer ? run(outer) : db.transaction(run);
}

/** The assigned technician accepts (optionally booking the visit) or rejects the job. */
export async function respondToAssignment(
  access: CaseAccess,
  input: { action: "accept"; scheduledAt?: Date } | { action: "reject"; reason: string },
) {
  return db.transaction(async (tx) => {
    const a = await activeAssignment(tx, access.kase.id);
    if (!a || a.technicianId !== access.actor.user.id) throw new HttpError(404, "Job not found", "not_found");
    if (input.action === "accept") {
      if (a.assignmentStatus === "accepted") throw new HttpError(409, "You already accepted this job.", "already_accepted");
      await tx.update(caseAssignments).set({ assignmentStatus: "accepted", acceptedAt: new Date() }).where(eq(caseAssignments.id, a.id));
      // Accepting confirms the technician has received the handoff.
      await tx
        .update(caseHandoffs)
        .set({ acknowledgedAt: new Date() })
        .where(and(eq(caseHandoffs.caseId, access.kase.id), eq(caseHandoffs.toUserId, access.actor.user.id), isNull(caseHandoffs.acknowledgedAt)));
      await tx.insert(caseEvents).values({ caseId: access.kase.id, actorId: access.actor.user.id, eventType: "assignment_accepted", metadata: {} });
      if (input.scheduledAt) await scheduleVisit(access, input.scheduledAt, tx);
      return { status: "accepted" as const };
    }
    await tx.update(caseAssignments).set({ assignmentStatus: "rejected", note: input.reason }).where(eq(caseAssignments.id, a.id));
    await removeParticipant(tx, access.kase.id, access.actor.user.id);
    await transitionCase(access, { to: "awaiting_assignment", reason: input.reason }, tx);
    await enqueue("nexconn.group.sync", { caseId: access.kase.id }, { tx });
    return { status: "rejected" as const };
  });
}
