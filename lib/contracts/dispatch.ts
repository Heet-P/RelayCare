import { z } from "zod";

/** A visit time must be in the future (5 minutes of clock slack allowed). */
const futureDate = z.coerce.date().refine((d) => d.getTime() > Date.now() - 5 * 60_000, "Choose a time in the future.");

/** POST /api/cases/:id/assign — dispatcher assigns or reassigns a technician. */
export const AssignRequest = z.object({
  technicianId: z.uuid(),
  servicePartnerId: z.uuid().optional(),
  scheduledAt: futureDate.optional(),
  note: z.string().trim().max(500).optional(),
  /** Must be true to replace a technician who is already assigned ("Change technician"). */
  reassign: z.boolean().default(false),
});

/** POST /api/cases/:id/schedule — book or move the visit. */
export const ScheduleRequest = z.object({ scheduledAt: futureDate });

/** POST /api/cases/:id/assignment — the assigned technician answers the job offer. */
export const AssignmentResponse = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), scheduledAt: futureDate.optional() }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3, "Tell dispatch why.").max(500) }),
]);

/** POST /api/cases/:id/resolution — the technician's completion report (spec Journey E). */
export const CompletionReport = z.object({
  resolutionType: z.enum(["repair", "replacement", "return", "refund", "no_fault_found", "not_covered"]),
  findings: z.string().trim().min(5, "Describe what you found.").max(2000),
  workPerformed: z.string().trim().min(5, "Describe the work you did.").max(2000),
  partsReplaced: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  notes: z.string().trim().max(1000).optional(),
});
export type CompletionReport = z.infer<typeof CompletionReport>;

/** POST /api/cases/:id/feedback — customer rating after confirming the fix. */
export const Feedback = z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });
