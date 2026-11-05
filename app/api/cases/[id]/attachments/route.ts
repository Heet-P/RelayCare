import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { AttachmentRequest, EVIDENCE_LIMITS } from "@/lib/contracts/cases";
import { db } from "@/lib/db/client";
import { caseAttachments, caseEvents } from "@/lib/db/schema";
import { handle, HttpError } from "@/lib/http";
import { objectInfo, safeName, signedUpload } from "@/lib/storage";

/** What an upload counts as, from who uploaded it. */
const PURPOSE = { customer: "complaint", technician: "inspection", owner: "document", support_agent: "document", dispatcher: "document" } as const;

/**
 * POST /api/cases/:id/attachments — structured case evidence (spec §9 "Message history and attachments").
 *   { intent: "upload", ... }   → signed one-time upload URL for a server-chosen key under this case
 *   { intent: "register", ... } → verify the object really exists with the declared size/type, then record it
 * Never trusts a client-supplied URL or path outside the case's own folder.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/attachments">) => {
  const { id } = await ctx.params;
  const { kase, actor, role } = await requireCaseAccess(id);
  const body = AttachmentRequest.parse(await req.json());

  const limit = EVIDENCE_LIMITS[body.mimeType as keyof typeof EVIDENCE_LIMITS];
  if (body.sizeBytes > limit) throw new HttpError(413, `That file is too large (max ${Math.round(limit / 1024 / 1024)} MB).`, "too_large");
  const prefix = `${kase.organizationId}/${kase.id}/`;

  if (body.intent === "upload") {
    const objectKey = `${prefix}${randomUUID()}-${safeName(body.fileName)}`;
    return NextResponse.json({ objectKey, ...(await signedUpload(objectKey)) });
  }

  if (!body.objectKey.startsWith(prefix) || body.objectKey.includes("..")) throw new HttpError(400, "Invalid object key", "bad_key");
  const info = await objectInfo(body.objectKey);
  if (!info) throw new HttpError(400, "Upload not found. Try uploading the file again.", "missing_upload");
  if (info.size !== body.sizeBytes || (info.contentType && info.contentType !== body.mimeType)) {
    throw new HttpError(400, "Uploaded file does not match its description.", "mismatch");
  }

  const [row] = await db
    .insert(caseAttachments)
    .values({
      caseId: kase.id,
      uploadedBy: actor.user.id,
      objectKey: body.objectKey,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      checksum: body.checksum,
      purpose: PURPOSE[role],
    })
    .onConflictDoNothing({ target: caseAttachments.objectKey })
    .returning({ id: caseAttachments.id });
  if (row) {
    await db.insert(caseEvents).values({
      caseId: kase.id,
      actorId: actor.user.id,
      eventType: "evidence_added",
      metadata: { attachmentId: row.id, fileName: body.fileName, purpose: PURPOSE[role] },
    });
  }
  return NextResponse.json({ attachmentId: row?.id ?? null }, { status: 201 });
});
