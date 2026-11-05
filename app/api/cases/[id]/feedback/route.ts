import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { Feedback } from "@/lib/contracts/dispatch";
import { db } from "@/lib/db/client";
import { caseEvents, serviceCases } from "@/lib/db/schema";
import { handle, HttpError } from "@/lib/http";

/** POST /api/cases/:id/feedback — the customer rates the service once it is resolved. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/feedback">) => {
  const { id } = await ctx.params;
  const { kase, actor } = await requireCaseAccess(id, ["customer"]);
  if (kase.status !== "resolved" && kase.status !== "closed") throw new HttpError(409, "You can rate the service once the problem is resolved.", "not_resolved");
  const { score, comment } = Feedback.parse(await req.json());
  await db.update(serviceCases).set({ csatScore: score, csatComment: comment ?? null }).where(eq(serviceCases.id, kase.id));
  await db.insert(caseEvents).values({ caseId: kase.id, actorId: actor.user.id, eventType: "feedback_given", metadata: { score } });
  return NextResponse.json({ score });
});
