import { after, NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { completeWork } from "@/lib/cases/assign";
import { CompletionReport } from "@/lib/contracts/dispatch";
import { handle } from "@/lib/http";
import { runJobs } from "@/lib/jobs/worker";

/**
 * POST /api/cases/:id/resolution — the assigned technician files the completion report.
 * Never closes the case: the customer must confirm (spec §12, "never close a case because a
 * technician sends a chat message saying done").
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/resolution">) => {
  const { id } = await ctx.params;
  const access = await requireCaseAccess(id, ["technician"]);
  await completeWork(access, CompletionReport.parse(await req.json()));
  after(() => runJobs({ budgetMs: 15_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json({ status: "resolution_pending" });
});
