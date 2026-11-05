import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { createCase } from "@/lib/cases/create";
import { CreateCaseInput } from "@/lib/contracts/cases";
import { handle } from "@/lib/http";

/** POST /api/cases — a verified customer reports a problem with one of their purchases. */
export const POST = handle(async (req: Request) => {
  const actor = await requireActor();
  const input = CreateCaseInput.parse(await req.json());
  return NextResponse.json(await createCase(actor, input), { status: 201 });
});
