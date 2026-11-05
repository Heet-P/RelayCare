import { after, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { createCase } from "@/lib/cases/create";
import { CreateCaseInput } from "@/lib/contracts/cases";
import { handle } from "@/lib/http";
import { runJobs } from "@/lib/jobs/worker";

/** POST /api/cases — a verified customer reports a problem with one of their purchases. */
export const POST = handle(async (req: Request) => {
  const actor = await requireActor();
  const input = CreateCaseInput.parse(await req.json());
  const result = await createCase(actor, input);
  after(() => runJobs({ budgetMs: 10_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json(result, { status: 201 });
});
