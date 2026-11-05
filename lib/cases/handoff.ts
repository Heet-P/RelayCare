import { z } from "zod";

/**
 * Structured handoff (spec Journey C, §17 Decision 2): the source of context for whoever picks
 * the case up next. Stored as a versioned snapshot in case_handoffs.context_snapshot, so later
 * edits to the case never change what the technician was handed.
 */
export const HandoffV1 = z.object({
  version: z.literal(1),
  case: z.string(),
  product: z.string(),
  serialNumber: z.string().nullable(),
  order: z.object({ number: z.string(), purchasedAt: z.string().nullable() }),
  customer: z.object({ name: z.string(), phone: z.string().nullable(), email: z.string(), address: z.string().nullable(), language: z.string() }),
  issue: z.string(),
  complaint: z.string(),
  symptoms: z.array(z.string()),
  troubleshooting: z.array(z.string()),
  warranty: z.string(),
  actionRequired: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  evidence: z.array(z.object({ id: z.string(), fileName: z.string() })),
  notes: z.string().nullable(),
  preparedBy: z.string(),
  preparedAt: z.string(),
});
export type HandoffV1 = z.infer<typeof HandoffV1>;

/** What the agent fills in; the server adds everything it already knows. */
export const HandoffInput = z.object({
  symptoms: z.array(z.string().trim().min(1).max(300)).min(1, "Add at least one symptom.").max(10),
  troubleshooting: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  actionRequired: z.string().trim().min(3, "Say what the technician should do.").max(500),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  attachmentIds: z.array(z.uuid()).max(20).default([]),
  notes: z.string().trim().max(2000).optional(),
  sendToDispatch: z.boolean().default(true),
});
export type HandoffInput = z.infer<typeof HandoffInput>;

export const WarrantyDecision = z
  .object({
    status: z.enum(["eligible", "expired", "not_covered", "exception", "pending"]),
    notes: z.string().trim().max(1000).optional(),
    startsAt: z.iso.date().optional(),
    expiresAt: z.iso.date().optional(),
  })
  .refine((d) => d.status !== "exception" || !!d.notes, { message: "Explain why this is an exception.", path: ["notes"] });
export type WarrantyDecision = z.infer<typeof WarrantyDecision>;
