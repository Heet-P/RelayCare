// Local job worker: polls /api/jobs/run (the same endpoint pg_cron calls in production).
//   pnpm worker            (requires `pnpm dev` running)
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const url = `${process.env.WORKER_BASE_URL ?? "http://localhost:3000"}/api/jobs/run`;

async function tick() {
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const stats = await res.json();
    if (stats.done || stats.failed) console.log(new Date().toISOString(), stats);
  } catch (e) {
    console.error("worker:", (e as Error).message);
  }
  setTimeout(tick, 3000);
}
console.log(`worker polling ${url}`);
tick();
