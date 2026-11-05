import { after, NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { assignTechnician } from "@/lib/cases/assign";
import { AssignRequest } from "@/lib/contracts/dispatch";
import { handle } from "@/lib/http";
import { runJobs } from "@/lib/jobs/worker";

/** POST /api/cases/:id/assign — spec §10: the backend is the only writer of assignments. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/assign">) => {
  const { id } = await ctx.params;
  const access = await requireCaseAccess(id, ["owner", "dispatcher"]);
  const input = AssignRequest.parse(await req.json());
  const result = await assignTechnician(access, input);
  // Create/update the Nexconn group right after the response; the cron sweep retries failures.
  after(() => runJobs({ budgetMs: 20_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json(result, { status: 201 });
});
