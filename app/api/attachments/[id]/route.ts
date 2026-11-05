import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolveCaseAccess } from "@/lib/auth/access";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { caseAttachments } from "@/lib/db/schema";
import { handle, notFound } from "@/lib/http";
import { signedDownload } from "@/lib/storage";

/**
 * GET /api/attachments/:id — redirect to a 5-minute signed URL after checking case access
 * (and staff-only visibility). Chat messages reference evidence by this id, never by URL.
 */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/attachments/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireActor();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const [file] = await db.select().from(caseAttachments).where(eq(caseAttachments.id, id));
  if (!file) throw notFound();
  const access = await resolveCaseAccess(actor, file.caseId);
  const staff = access && ["owner", "support_agent", "dispatcher"].includes(access.role);
  if (!access || (file.visibility === "staff_only" && !staff)) throw notFound();

  const download = new URL(req.url).searchParams.has("download") ? file.fileName : undefined;
  const res = NextResponse.redirect(await signedDownload(file.objectKey, download), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
});
