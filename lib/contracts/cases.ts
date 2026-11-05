import { z } from "zod";
import { CATEGORY_KEYS } from "@/lib/cases/categories";

/** POST /api/cases — customer reports a problem with one purchased item. */
export const CreateCaseInput = z.object({
  orderItemId: z.uuid(),
  category: z.enum(CATEGORY_KEYS),
  description: z.string().trim().min(10, "Describe the problem in at least a few words.").max(4000),
  troubleshooting: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  serialNumber: z.string().trim().max(80).optional(),
});
export type CreateCaseInput = z.infer<typeof CreateCaseInput>;
export type CreateCaseResult = { caseId: string; caseNumber: string };

/** Evidence uploads: limits enforced on the server (spec §19 "file upload limits"). */
export const EVIDENCE_LIMITS = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "image/heic": 10 * 1024 * 1024,
  "video/mp4": 50 * 1024 * 1024,
  "video/quicktime": 50 * 1024 * 1024,
  "application/pdf": 10 * 1024 * 1024,
} as const;
export const EVIDENCE_TYPES = Object.keys(EVIDENCE_LIMITS) as (keyof typeof EVIDENCE_LIMITS)[];

const FileMeta = {
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(EVIDENCE_TYPES as [string, ...string[]]),
  sizeBytes: z.number().int().positive(),
};

export const AttachmentRequest = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("upload"), ...FileMeta }),
  z.object({
    intent: z.literal("register"),
    ...FileMeta,
    objectKey: z.string().min(1).max(500),
    checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),
]);
export type AttachmentRequest = z.infer<typeof AttachmentRequest>;

/** PATCH /api/cases/:id/status — request a state-machine transition. */
export const TransitionRequest = z.object({
  to: z.enum(["submitted", "under_triage", "warranty_review", "awaiting_assignment", "assigned", "scheduled", "in_progress", "resolution_pending", "awaiting_customer", "resolved", "closed", "escalated", "rejected", "cancelled", "reopened"]),
  reason: z.string().trim().max(2000).optional(),
  resolutionType: z.enum(["repair", "replacement", "return", "refund", "no_fault_found", "not_covered"]).optional(),
  resolutionNotes: z.string().trim().max(4000).optional(),
});
export type TransitionRequest = z.infer<typeof TransitionRequest>;
