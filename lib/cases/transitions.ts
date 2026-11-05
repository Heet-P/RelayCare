import "server-only";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { CaseAccess } from "@/lib/auth/access";
import { db, type Tx } from "@/lib/db/client";
import { caseAssignments, caseAttachments, caseEvents, caseHandoffs, caseParticipants, serviceCases } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { enqueue } from "@/lib/jobs/queue";
import { canTransition, ownerKindFor, type CaseStatus, type ResolutionType } from "./state-machine";

export type TransitionInput = {
  to: CaseStatus;
  reason?: string;
  resolutionType?: ResolutionType;
  resolutionNotes?: string;
};

const ERROR_STATUS = { invalid_transition: 409, forbidden: 403, precondition_failed: 422 } as const;

/**
 * The ONLY way a case changes status (spec §12: "a case transition is an authorised business
 * operation"). Runs in one transaction with the case row locked, so concurrent clicks cannot
 * race; the DB trigger re-checks the (from, to) pair as a last line of defence.
 */
export async function transitionCase(access: CaseAccess, input: TransitionInput, outer?: Tx) {
  const run = async (tx: Tx) => {
    const [kase] = await tx.select().from(serviceCases).where(eq(serviceCases.id, access.kase.id)).for("update");
    const from = kase.status;
    const ctx = await loadContext(tx, kase.id);

    const verdict = canTransition(from, input.to, access.role, {
      ...ctx,
      warrantyStatus: kase.warrantyStatus,
      escalatedFromStatus: kase.escalatedFromStatus,
      reason: input.reason,
      resolutionType: input.resolutionType ?? (input.to === "resolution_pending" ? ctx.reportResolutionType : null),
      resolutionNotes: input.resolutionNotes,
    });
    if (!verdict.ok) throw new HttpError(ERROR_STATUS[verdict.code], verdict.message, verdict.code);

    const now = new Date();
    const [updated] = await tx
      .update(serviceCases)
      .set({
        status: input.to,
        currentOwnerId: await ownerFor(tx, kase, input.to),
        ...(input.to === "escalated" ? { escalatedFromStatus: from } : {}),
        ...(from === "escalated" ? { escalatedFromStatus: null } : {}),
        ...(input.resolutionType ? { resolutionType: input.resolutionType, resolutionNotes: input.resolutionNotes ?? null } : {}),
        ...(input.to === "resolved" ? { resolvedAt: now } : {}),
        ...(input.to === "closed" ? { closedAt: now } : {}),
        ...(input.to === "reopened" ? { resolvedAt: null } : {}),
      })
      .where(eq(serviceCases.id, kase.id))
      .returning();

    await tx.insert(caseEvents).values({
      caseId: kase.id,
      actorId: access.actor.user.id,
      eventType: "status_changed",
      oldStatus: from,
      newStatus: input.to,
      metadata: { action: verdict.action, ...(input.reason ? { reason: input.reason } : {}), ...(input.resolutionType ? { resolutionType: input.resolutionType } : {}) },
    });
    // Customer-facing notifications, enqueued in the same transaction as the change.
    if (input.to === "awaiting_customer") await enqueue("case.notify", { caseId: kase.id, kind: "info_requested", detail: input.reason ?? "" }, { tx });
    if (input.to === "closed") await enqueue("case.notify", { caseId: kase.id, kind: "case_closed" }, { tx });
    return updated;
  };
  return outer ? run(outer) : db.transaction(run);
}

/** Facts the state machine's preconditions need, read inside the locked transaction. */
async function loadContext(tx: Tx, caseId: string) {
  const [handoffs] = await tx.select({ n: count() }).from(caseHandoffs).where(eq(caseHandoffs.caseId, caseId));
  const [active] = await tx
    .select()
    .from(caseAssignments)
    .where(and(eq(caseAssignments.caseId, caseId), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted"])));
  const [evidence] = await tx
    .select({ n: count() })
    .from(caseAttachments)
    .where(and(eq(caseAttachments.caseId, caseId), inArray(caseAttachments.purpose, ["inspection", "repair"])));
  const report = active?.report as { resolutionType?: ResolutionType } | null | undefined;
  return {
    hasHandoff: handoffs.n > 0,
    hasActiveAssignment: !!active,
    scheduledAt: active?.scheduledAt ?? null,
    hasCompletionReport: !!report,
    reportResolutionType: report?.resolutionType ?? null,
    technicianEvidenceCount: evidence.n,
  };
}

/** Spec §4B: the case page always shows the current owner. Owner follows the status. */
async function ownerFor(tx: Tx, kase: typeof serviceCases.$inferSelect, to: CaseStatus): Promise<string | null> {
  switch (ownerKindFor(to)) {
    case "agent":
      return kase.assignedAgentId;
    case "technician": {
      const [a] = await tx
        .select({ id: caseAssignments.technicianId })
        .from(caseAssignments)
        .where(and(eq(caseAssignments.caseId, kase.id), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted"])));
      return a?.id ?? null;
    }
    case "customer": {
      const [p] = await tx
        .select({ id: caseParticipants.userId })
        .from(caseParticipants)
        .where(and(eq(caseParticipants.caseId, kase.id), eq(caseParticipants.participantRole, "customer"), sql`${caseParticipants.removedAt} is null`));
      return p?.id ?? null;
    }
    default:
      return null; // dispatch queue or closed: no single person holds it
  }
}
