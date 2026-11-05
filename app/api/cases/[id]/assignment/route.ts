import { after, NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { respondToAssignment } from "@/lib/cases/assign";
import { AssignmentResponse } from "@/lib/contracts/dispatch";
import { handle } from "@/lib/http";
import { runJobs } from "@/lib/jobs/worker";

/** POST /api/cases/:id/assignment — the assigned technician accepts or rejects the job. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/assignment">) => {
  const { id } = await ctx.params;
  const access = await requireCaseAccess(id, ["technician"]);
  const result = await respondToAssignment(access, AssignmentResponse.parse(await req.json()));
  if (result.status === "rejected") after(() => runJobs({ budgetMs: 20_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json(result);
});
