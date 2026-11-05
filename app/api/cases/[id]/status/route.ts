import { after, NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { transitionCase } from "@/lib/cases/transitions";
import { TransitionRequest } from "@/lib/contracts/cases";
import { handle } from "@/lib/http";
import { runJobs } from "@/lib/jobs/worker";

/**
 * PATCH /api/cases/:id/status — spec §10. Checks, in order: signed in → case exists → viewer
 * may see it → role may perform this transition → preconditions hold (409/403/422 otherwise).
 */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/status">) => {
  const { id } = await ctx.params;
  const access = await requireCaseAccess(id);
  const input = TransitionRequest.parse(await req.json());
  const updated = await transitionCase(access, input);
  after(() => runJobs({ budgetMs: 10_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json({ status: updated.status, currentOwnerId: updated.currentOwnerId });
});
