import type { CaseStatus } from "./state-machine";

/** Customer-facing progress (spec §4D: customers should not need to understand dispatch internals). */
export const CUSTOMER_STEPS = ["Reported", "Reviewing", "Technician", "Repair", "Resolved"] as const;

type Ctx = { agent?: string | null; technician?: string | null; visitAt?: Date | null };

export function customerStatus(status: CaseStatus, ctx: Ctx = {}): { step: number; headline: string; next: string } {
  const agent = ctx.agent ?? "A support agent";
  const tech = ctx.technician ?? "Your technician";
  const visit = ctx.visitAt
    ? new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(ctx.visitAt)
    : null;
  switch (status) {
    case "submitted":
      return { step: 0, headline: "We've received your report", next: `${agent} will review it shortly. You can add photos or details below.` };
    case "under_triage":
      return { step: 1, headline: "Reviewing your report", next: `${agent} is looking at your report and may message you with questions.` };
    case "warranty_review":
      return { step: 1, headline: "Checking your warranty", next: "We're confirming your warranty cover. No action needed from you." };
    case "awaiting_customer":
      return { step: 1, headline: "We need a little more from you", next: `${agent} has asked a question. Reply in the conversation below.` };
    case "escalated":
      return { step: 1, headline: "A senior team member is on it", next: "Your case has been escalated. We'll update you here." };
    case "reopened":
      return { step: 1, headline: "We're looking at it again", next: "You told us the problem isn't fixed. The team is reviewing what happens next." };
    case "awaiting_assignment":
      return { step: 2, headline: "Arranging a technician", next: "We're choosing a technician near you." };
    case "assigned":
      return { step: 2, headline: `${tech} will handle your repair`, next: `${tech} has your full case details and will confirm a visit time.` };
    case "scheduled":
      return { step: 2, headline: "Visit booked", next: visit ? `${tech} will visit on ${visit}.` : `${tech} will confirm the visit time.` };
    case "in_progress":
      return { step: 3, headline: "Repair in progress", next: `${tech} is working on your product.` };
    case "resolution_pending":
      return { step: 3, headline: "Did this fix the problem?", next: "Check the repair report below and confirm, or tell us if it's still not right." };
    case "resolved":
      return { step: 4, headline: "Resolved", next: "Thanks for confirming. The store will close this case." };
    case "closed":
      return { step: 4, headline: "Case closed", next: "The full history stays here with your purchase." };
    case "rejected":
      return { step: 1, headline: "We couldn't take this on", next: "See the conversation for the reason and what you can do next." };
    case "cancelled":
      return { step: 0, headline: "Cancelled", next: "You cancelled this case. You can report a new problem any time." };
  }
}
