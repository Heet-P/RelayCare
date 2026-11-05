import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseParticipants, serviceCases } from "@/lib/db/schema";
import { forbidden, notFound } from "@/lib/http";
import type { ActorRole } from "@/lib/cases/state-machine";
import { type Actor, type MemberRole, requireActor, roleIn } from "./session";

export type CaseAccess = {
  actor: Actor;
  kase: typeof serviceCases.$inferSelect;
  /** The role this actor plays on THIS case. */
  role: ActorRole;
};

const STAFF_ROLES: MemberRole[] = ["owner", "support_agent", "dispatcher"];

/**
 * Spec §10 — every case API verifies, in order:
 *  1. the user is authenticated,  2. the case exists,
 *  3. the user is org staff, an ACTIVE participant, or the owning customer,
 *  4. the role permits the action (`allow`),  5. the transition is valid (state machine, caller).
 * Cases the user may not see return 404, never 403, so case IDs cannot be probed.
 */
export async function requireCaseAccess(caseId: string, allow?: ActorRole[]): Promise<CaseAccess> {
  const actor = await requireActor();
  const access = await resolveCaseAccess(actor, caseId);
  if (!access) throw notFound("Case not found");
  if (allow && !allow.includes(access.role)) throw forbidden("Your role cannot perform this action");
  return access;
}

export async function resolveCaseAccess(actor: Actor, caseId: string): Promise<CaseAccess | null> {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return null;
  const [kase] = await db.select().from(serviceCases).where(eq(serviceCases.id, caseId));
  if (!kase) return null;

  const memberRole = roleIn(actor, kase.organizationId);
  if (memberRole && STAFF_ROLES.includes(memberRole)) return { actor, kase, role: memberRole };

  if (memberRole === "technician") {
    // Technicians see only cases they are an active participant of (i.e. currently assigned).
    const [p] = await db
      .select({ id: caseParticipants.id })
      .from(caseParticipants)
      .where(
        and(eq(caseParticipants.caseId, caseId), eq(caseParticipants.userId, actor.user.id), isNull(caseParticipants.removedAt)),
      );
    return p ? { actor, kase, role: "technician" } : null;
  }

  if (actor.customerIds.includes(kase.customerId)) return { actor, kase, role: "customer" };
  return null;
}

/** Staff-only endpoints scoped to one organization. */
export async function requireOrgRole(allow: MemberRole[], organizationId?: string) {
  const actor = await requireActor();
  const membership = organizationId
    ? actor.memberships.find((m) => m.organizationId === organizationId)
    : actor.memberships.find((m) => allow.includes(m.role));
  if (!membership || !allow.includes(membership.role)) throw forbidden();
  return { actor, organizationId: membership.organizationId, role: membership.role };
}
