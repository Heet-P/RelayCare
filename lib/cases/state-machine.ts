/**
 * Strict service-case state machine (spec §5).
 *
 * Pure and dependency-free so it runs in route handlers, the UI (to decide which action
 * buttons to show) and tests. The same TRANSITIONS table is mirrored into the database
 * (`case_status_transitions`) so even a buggy caller cannot write an illegal status;
 * tests/unit/state-machine.test.ts asserts the two stay identical.
 *
 * What this module does NOT check: *which* technician or customer is acting. That is the
 * access layer's job (lib/auth/access.ts). Here a role is enough.
 */

export const CASE_STATUSES = [
  "submitted",
  "under_triage",
  "warranty_review",
  "awaiting_assignment",
  "assigned",
  "scheduled",
  "in_progress",
  "resolution_pending",
  "awaiting_customer",
  "resolved",
  "closed",
  "escalated",
  "rejected",
  "cancelled",
  "reopened",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type ActorRole = "customer" | "owner" | "support_agent" | "dispatcher" | "technician";

export const RESOLUTION_TYPES = ["repair", "replacement", "return", "refund", "no_fault_found", "not_covered"] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

/** Resolutions a merchant can record without sending a technician. */
const DESK_RESOLUTIONS: ResolutionType[] = ["replacement", "return", "refund", "not_covered"];

export const TERMINAL: CaseStatus[] = ["closed", "rejected", "cancelled"];

/** Statuses from which a case may be escalated. */
const ESCALATABLE: CaseStatus[] = [
  "submitted",
  "under_triage",
  "warranty_review",
  "awaiting_assignment",
  "assigned",
  "scheduled",
  "in_progress",
  "awaiting_customer",
  "resolution_pending",
  "reopened",
];

/** Facts the caller loads from the DB / request so preconditions can be checked purely. */
export type TransitionContext = {
  reason?: string;
  warrantyStatus?: string;
  hasHandoff?: boolean;
  hasActiveAssignment?: boolean;
  scheduledAt?: Date | string | null;
  resolutionType?: ResolutionType | null;
  resolutionNotes?: string | null;
  technicianEvidenceCount?: number;
  hasCompletionReport?: boolean;
  escalatedFromStatus?: CaseStatus | null;
};

type Rule = {
  from: CaseStatus[];
  to: CaseStatus;
  roles: ActorRole[];
  /** Short machine-friendly action name used by the UI and events. */
  action: string;
  /** Returns an error message when a precondition is not met. */
  check?: (ctx: TransitionContext) => string | null;
};

const STAFF: ActorRole[] = ["owner", "support_agent"];
const DISPATCH: ActorRole[] = ["owner", "dispatcher"];

const needReason = (ctx: TransitionContext) => (ctx.reason?.trim() ? null : "A reason is required.");

export const TRANSITIONS: Rule[] = [
  { action: "start_triage", from: ["submitted"], to: "under_triage", roles: STAFF },
  {
    action: "request_info",
    from: ["under_triage", "warranty_review"],
    to: "awaiting_customer",
    roles: STAFF,
    check: needReason,
  },
  { action: "info_provided", from: ["awaiting_customer"], to: "under_triage", roles: ["customer", ...STAFF] },
  { action: "review_warranty", from: ["under_triage"], to: "warranty_review", roles: STAFF },
  {
    action: "send_to_dispatch",
    from: ["warranty_review"],
    to: "awaiting_assignment",
    roles: STAFF,
    check: (ctx) => {
      if (ctx.warrantyStatus !== "eligible" && ctx.warrantyStatus !== "exception")
        return "Warranty must be verified as eligible or marked as an exception first.";
      if (!ctx.hasHandoff) return "Create a structured handoff before sending to dispatch.";
      return null;
    },
  },
  {
    action: "propose_desk_resolution",
    from: ["warranty_review"],
    to: "resolution_pending",
    roles: STAFF,
    check: (ctx) => {
      if (!ctx.resolutionType || !DESK_RESOLUTIONS.includes(ctx.resolutionType))
        return `Choose one of: ${DESK_RESOLUTIONS.join(", ")}.`;
      return ctx.resolutionNotes?.trim() ? null : "Resolution notes are required.";
    },
  },
  { action: "reject", from: ["under_triage", "warranty_review"], to: "rejected", roles: STAFF, check: needReason },
  {
    action: "assign_technician",
    from: ["awaiting_assignment"],
    to: "assigned",
    roles: DISPATCH,
    check: (ctx) => (ctx.hasActiveAssignment ? null : "Assignments are created by the assign endpoint only."),
  },
  {
    action: "schedule",
    from: ["assigned"],
    to: "scheduled",
    roles: ["technician", ...DISPATCH],
    check: (ctx) => (ctx.scheduledAt ? null : "An appointment time is required."),
  },
  {
    action: "unassign",
    from: ["assigned", "scheduled"],
    to: "awaiting_assignment",
    roles: ["technician", ...DISPATCH],
    check: needReason,
  },
  { action: "start_work", from: ["scheduled"], to: "in_progress", roles: ["technician"] },
  {
    action: "complete_work",
    from: ["in_progress"],
    to: "resolution_pending",
    roles: ["technician"],
    check: (ctx) => {
      if (!ctx.resolutionType) return "Choose a resolution type.";
      if (!ctx.hasCompletionReport) return "Submit a completion report.";
      if (!ctx.technicianEvidenceCount) return "Upload at least one inspection or repair photo.";
      return null;
    },
  },
  // Only the customer can accept a resolution (spec: customer-confirmed resolution).
  { action: "confirm_resolution", from: ["resolution_pending"], to: "resolved", roles: ["customer"] },
  {
    action: "reject_resolution",
    from: ["resolution_pending", "resolved"],
    to: "reopened",
    roles: ["customer"],
    check: needReason,
  },
  { action: "close", from: ["resolved"], to: "closed", roles: STAFF },
  { action: "retriage", from: ["reopened"], to: "under_triage", roles: STAFF },
  { action: "redispatch", from: ["reopened"], to: "awaiting_assignment", roles: DISPATCH },
  {
    action: "escalate",
    from: ESCALATABLE,
    to: "escalated",
    roles: ["support_agent", "dispatcher", "owner"],
    check: needReason,
  },
  { action: "deescalate_triage", from: ["escalated"], to: "under_triage", roles: DISPATCH },
  { action: "deescalate_dispatch", from: ["escalated"], to: "awaiting_assignment", roles: DISPATCH },
  {
    action: "cancel",
    from: ["submitted", "under_triage", "awaiting_customer"],
    to: "cancelled",
    roles: ["customer", "owner"],
    check: needReason,
  },
];

/** Every legal (from, to) pair. Mirrored into the DB transition table. */
export const ALLOWED_PAIRS: ReadonlyArray<readonly [CaseStatus, CaseStatus]> = (() => {
  const pairs = new Set<string>();
  for (const r of TRANSITIONS) for (const f of r.from) pairs.add(`${f}>${r.to}`);
  // De-escalation may restore any status the case was escalated from.
  for (const s of ESCALATABLE) pairs.add(`escalated>${s}`);
  return [...pairs].sort().map((p) => p.split(">") as [CaseStatus, CaseStatus]);
})();

export type TransitionResult =
  | { ok: true; action: string }
  | { ok: false; code: "invalid_transition" | "forbidden" | "precondition_failed"; message: string };

/** Decide whether `role` may move a case from `from` to `to` given the loaded context. */
export function canTransition(
  from: CaseStatus,
  to: CaseStatus,
  role: ActorRole,
  ctx: TransitionContext = {},
): TransitionResult {
  // Restoring the exact pre-escalation status is a dispatch decision.
  if (from === "escalated" && ctx.escalatedFromStatus === to && to !== "escalated") {
    return DISPATCH.includes(role)
      ? { ok: true, action: "deescalate_restore" }
      : { ok: false, code: "forbidden", message: "Only dispatch can de-escalate a case." };
  }

  const candidates = TRANSITIONS.filter((r) => r.to === to && r.from.includes(from));
  if (candidates.length === 0) {
    return { ok: false, code: "invalid_transition", message: `Cannot move a case from ${from} to ${to}.` };
  }
  const rule = candidates.find((r) => r.roles.includes(role));
  if (!rule) {
    return { ok: false, code: "forbidden", message: `Your role cannot move a case from ${from} to ${to}.` };
  }
  const problem = rule.check?.(ctx);
  return problem ? { ok: false, code: "precondition_failed", message: problem } : { ok: true, action: rule.action };
}

/** Transitions a role could attempt from the current status (drives UI action buttons). */
export function availableActions(from: CaseStatus, role: ActorRole) {
  return TRANSITIONS.filter((r) => r.from.includes(from) && r.roles.includes(role)).map((r) => ({
    action: r.action,
    to: r.to,
  }));
}

/** Which kind of party owns the case in each status ("current owner" on the case page). */
export function ownerKindFor(status: CaseStatus): "agent" | "dispatcher" | "technician" | "customer" | null {
  switch (status) {
    case "submitted":
    case "under_triage":
    case "warranty_review":
    case "reopened":
    case "resolved":
      return "agent";
    case "awaiting_assignment":
    case "escalated":
      return "dispatcher";
    case "assigned":
    case "scheduled":
    case "in_progress":
      return "technician";
    case "awaiting_customer":
    case "resolution_pending":
      return "customer";
    default:
      return null;
  }
}
