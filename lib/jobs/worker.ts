import "server-only";
import { claim, complete, fail } from "./queue";
import { handlers } from "./handlers";

/**
 * Drain ready jobs until none remain or the time budget is spent.
 * Called from: after() in webhook routes (immediate), /api/jobs/run (pg_cron sweep), scripts/worker.ts.
 */
export async function runJobs({ budgetMs = 20_000, batch = 5 } = {}) {
  const deadline = Date.now() + budgetMs;
  const stats = { done: 0, failed: 0 };
  while (Date.now() < deadline) {
    const ready = await claim(batch);
    if (!ready.length) break;
    for (const job of ready) {
      const handler = handlers[job.type];
      try {
        if (!handler) throw new Error(`No handler for job type "${job.type}"`);
        await handler(job.payload as Record<string, unknown>);
        await complete(job.id);
        stats.done++;
      } catch (err) {
        console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts})`, err);
        await fail(job, err);
        stats.failed++;
      }
    }
  }
  return stats;
}
