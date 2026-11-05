import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { runJobs } from "@/lib/jobs/worker";

export const maxDuration = 60;

/**
 * POST /api/jobs/run — drains the job queue. Called every minute by Supabase pg_cron + pg_net
 * and by `pnpm worker` locally. Protected by CRON_SECRET.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!process.env.CRON_SECRET || !safeEqual(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runJobs({ budgetMs: 45_000 }));
}
