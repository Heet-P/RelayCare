/**
 * Reset the demo organisation's SERVICE data so rehearsals are repeatable (plan Phase 8).
 * Keeps orgs, users, orders, warranties and the store connection; removes cases and
 * everything hanging off them, plus their evidence files, and resets the case counter.
 *
 *   pnpm demo:reset                 → next case is RC-<year>-0042 (the spec's demo number)
 *   DEMO_NEXT_CASE=1 pnpm demo:reset
 *
 * case_events is append-only by trigger. This script is the single sanctioned exception:
 * it disables that trigger as the table owner inside one transaction, then restores it.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
const NEXT_CASE = Number(process.env.DEMO_NEXT_CASE ?? 42);
const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const [org] = await sql`select id from organizations where slug = 'demo-electronics'`;
  if (!org) throw new Error("Demo org not found; run pnpm db:seed first");

  // Dismiss the Nexconn group chats of the cases being removed (rehearsals start clean).
  const { dismissGroup, clearDirectHistory } = await import("../lib/nexconn/server");
  const groups = await sql`select t.nexconn_group_id from chat_threads t join service_cases c on c.id = t.case_id
    where c.organization_id = ${org.id} and t.nexconn_group_id is not null`;
  for (const g of groups) await dismissGroup(g.nexconn_group_id).catch(() => undefined);

  // Direct chats belong to a pair of people, not a case, so old messages would greet the next
  // rehearsal. Clear both sides for every pair of demo people (a handful of users).
  const people = await sql`select distinct u.nexconn_user_id from users u
    left join organization_memberships m on m.user_id = u.id and m.organization_id = ${org.id}
    left join customers c on c.user_id = u.id and c.organization_id = ${org.id}
    where u.nexconn_user_id is not null and (m.user_id is not null or c.id is not null)`;
  const ids = people.map((p) => p.nexconn_user_id as string);
  for (const a of ids) for (const b of ids) if (a !== b) await clearDirectHistory(a, b).catch(() => undefined);

  const removed = await sql.begin(async (tx) => {
    const cases = tx`select id from service_cases where organization_id = ${org.id}`;
    await tx`alter table case_events disable trigger case_events_no_update`;
    for (const table of ["case_events", "case_attachments", "chat_threads", "case_handoffs", "case_assignments", "case_participants"]) {
      await tx`delete from ${tx(table)} where case_id in (${cases})`;
    }
    const gone = await tx`delete from service_cases where organization_id = ${org.id} returning id`;
    await tx`alter table case_events enable trigger case_events_no_update`;
    await tx`delete from jobs where status <> 'running' and (payload->>'caseId') is not null and not exists (select 1 from service_cases c where c.id::text = jobs.payload->>'caseId')`;
    await tx`
      insert into case_counters (organization_id, year, last_value)
      values (${org.id}, extract(year from now())::smallint, ${NEXT_CASE - 1})
      on conflict (organization_id, year) do update set last_value = excluded.last_value`;
    await tx`update technician_profiles set is_available = true where organization_id = ${org.id}`;
    return gone.length;
  });

  // Evidence files live under <orgId>/<caseId>/…
  const bucket = supabase.storage.from("case-evidence");
  const { data: folders } = await bucket.list(org.id, { limit: 1000 });
  let files = 0;
  for (const folder of folders ?? []) {
    const { data: objects } = await bucket.list(`${org.id}/${folder.name}`, { limit: 1000 });
    const paths = (objects ?? []).map((o) => `${org.id}/${folder.name}/${o.name}`);
    if (paths.length) {
      await bucket.remove(paths);
      files += paths.length;
    }
  }
  console.log(`Cleared direct chats between ${ids.length} people. Dismissed ${groups.length} group chat(s). Removed ${removed} case(s) and ${files} evidence file(s). Next case number: ${String(NEXT_CASE).padStart(4, "0")}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
