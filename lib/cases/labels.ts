import type { CaseStatus } from "./state-machine";

/** Staff-facing names for statuses (customers see lib/cases/customer-status.ts instead). */
export const STATUS_LABEL: Record<CaseStatus, string> = {
  submitted: "New",
  under_triage: "In triage",
  warranty_review: "Warranty review",
  awaiting_assignment: "Needs technician",
  assigned: "Assigned",
  scheduled: "Visit booked",
  in_progress: "Repair in progress",
  resolution_pending: "Awaiting customer confirmation",
  awaiting_customer: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
  rejected: "Rejected",
  cancelled: "Cancelled",
  reopened: "Reopened",
};

/** Chip tone per status: attention (needs staff), waiting (someone else), done. */
export const STATUS_TONE: Record<CaseStatus, "attention" | "active" | "waiting" | "done" | "alert"> = {
  submitted: "attention",
  under_triage: "active",
  warranty_review: "active",
  awaiting_assignment: "attention",
  assigned: "active",
  scheduled: "active",
  in_progress: "active",
  resolution_pending: "waiting",
  awaiting_customer: "waiting",
  resolved: "done",
  closed: "done",
  escalated: "alert",
  rejected: "done",
  cancelled: "done",
  reopened: "alert",
};

export const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as const;

export const ACTION_LABEL: Record<string, string> = {
  start_triage: "Start review",
  request_info: "Ask the customer",
  info_provided: "Customer replied",
  review_warranty: "Check warranty",
  send_to_dispatch: "Send to dispatch",
  propose_desk_resolution: "Resolve without a visit",
  reject: "Reject case",
  schedule: "Book visit",
  unassign: "Unassign technician",
  start_work: "Start work",
  complete_work: "Complete work",
  confirm_resolution: "Confirm fixed",
  reject_resolution: "Not fixed",
  close: "Close case",
  retriage: "Back to triage",
  redispatch: "Send back to dispatch",
  escalate: "Escalate",
  deescalate_triage: "Return to triage",
  deescalate_dispatch: "Return to dispatch",
  cancel: "Cancel case",
};

/** Past tense for the timeline ("Maya started the review"). */
const ACTION_DONE: Record<string, string> = {
  start_triage: "started the review",
  request_info: "asked the customer for more information",
  info_provided: "replied with the requested information",
  review_warranty: "started the warranty check",
  send_to_dispatch: "sent the case to dispatch",
  propose_desk_resolution: "proposed a resolution without a visit",
  reject: "rejected the case",
  assign_technician: "assigned a technician",
  schedule: "booked the visit",
  unassign: "removed the technician",
  start_work: "started work",
  complete_work: "completed the repair",
  confirm_resolution: "confirmed the problem is fixed",
  reject_resolution: "said the problem is not fixed",
  close: "closed the case",
  retriage: "sent the case back to triage",
  redispatch: "sent the case back to dispatch",
  escalate: "escalated the case",
  deescalate_triage: "returned the case to triage",
  deescalate_dispatch: "returned the case to dispatch",
  deescalate_restore: "de-escalated the case",
  cancel: "cancelled the case",
};

/** "3h", "2d" — compact age for queues. */
export function age(from: Date | string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(from).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

type EventLike = { eventType: string; newStatus: string | null; metadata: unknown };

/** One plain-English line per timeline event. */
export function describeEvent(e: EventLike): string {
  const m = (e.metadata ?? {}) as Record<string, string>;
  switch (e.eventType) {
    case "case_created":
      return "reported the problem";
    case "status_changed":
      return `${ACTION_DONE[m.action] ?? "updated the case"}${m.reason ? `: “${m.reason}”` : ""}`;
    case "warranty_verified":
      return `recorded warranty as ${m.status?.replace("_", " ")}${m.notes ? ` (${m.notes})` : ""}`;
    case "handoff_created":
      return "prepared the handoff for dispatch";
    case "technician_assigned":
      return `assigned ${m.technicianName ?? "a technician"}${m.previousTechnicianId ? " (replacing the previous technician)" : ""}`;
    case "assignment_accepted":
      return "accepted the job";
    case "visit_scheduled":
      return `${m.rescheduled ? "moved" : "booked"} the visit for ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(m.scheduledAt))}`;
    case "work_completed":
      return "finished the repair and filed the report";
    case "feedback_given":
      return `rated the service ${m.score} out of 5`;
    case "evidence_added":
      return `added ${m.purpose === "complaint" ? "a photo" : `${m.purpose ?? "a"} evidence`}: ${m.fileName ?? "file"}`;
    default:
      return e.eventType.replace(/_/g, " ");
  }
}
