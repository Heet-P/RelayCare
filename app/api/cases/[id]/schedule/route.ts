import { NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { scheduleVisit } from "@/lib/cases/assign";
import { ScheduleRequest } from "@/lib/contracts/dispatch";
import { handle } from "@/lib/http";

/** POST /api/cases/:id/schedule — dispatch, or the assigned technician, books or moves the visit. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/schedule">) => {
  const { id } = await ctx.params;
  const access = await requireCaseAccess(id, ["owner", "dispatcher", "technician"]);
  const { scheduledAt } = ScheduleRequest.parse(await req.json());
  await scheduleVisit(access, scheduledAt);
  return NextResponse.json({ scheduledAt });
});
