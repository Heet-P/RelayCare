import "server-only";
import { sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";

/**
 * Postgres-backed job queue (spec §11: keep the queue in PostgreSQL for the hackathon).
 * - enqueue inside the caller's transaction, so a job exists iff its data was committed
 * - claim with FOR UPDATE SKIP LOCKED: safe with concurrent workers (after(), cron, local loop)
 * - a crashed worker's job is reclaimed after LOCK_TIMEOUT
 * - failures retry with exponential backoff, then stop as `failed` with last_error kept
 */
export type Job = typeof jobs.$inferSelect;

const LOCK_TIMEOUT = "5 minutes";

export async function enqueue(
  type: string,
  payload: Record<string, unknown> = {},
  opts: { tx?: Tx; runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {},
) {
  await (opts.tx ?? db)
    .insert(jobs)
    .values({ type, payload, runAt: opts.runAt, dedupeKey: opts.dedupeKey, maxAttempts: opts.maxAttempts })
    .onConflictDoNothing({ target: jobs.dedupeKey });
}

export async function claim(limit: number): Promise<Job[]> {
  const rows = await db.execute<Job>(sql`
    update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
    where id in (
      select id from jobs
      where (status = 'pending' and run_at <= now())
         or (status = 'running' and locked_at < now() - ${LOCK_TIMEOUT}::interval)
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning id, type, payload, attempts, max_attempts as "maxAttempts"`);
  return rows as unknown as Job[];
}

export async function complete(id: string) {
  await db.execute(sql`update jobs set status = 'done', locked_at = null, last_error = null where id = ${id}`);
}

/** Backoff: 30s, 1m, 2m, 4m … until maxAttempts, then `failed`. */
export async function fail(job: Pick<Job, "id" | "attempts" | "maxAttempts">, error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const delaySeconds = 15 * 2 ** job.attempts;
  await db.execute(sql`
    update jobs set
      status = case when attempts >= ${job.maxAttempts} then 'failed'::job_status else 'pending'::job_status end,
      run_at = now() + make_interval(secs => ${delaySeconds}),
      locked_at = null,
      last_error = ${message.slice(0, 2000)}
    where id = ${job.id}`);
}
