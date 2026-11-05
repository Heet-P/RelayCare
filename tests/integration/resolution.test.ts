import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BASE_URL, call, deleteCases, sql } from "../helpers/api";

vi.mock("server-only", () => ({}));
const { dismissGroup } = await import("@/lib/nexconn/server");

/**
 * The full spec journey on the real API (Journeys B–E), ending with the critical tests
 * "A technician cannot close a case without the required completion workflow" and
 * "Never close a case because a technician sends a chat message saying done".
 */
const WC_ORDER = 960000 + Math.floor(Math.random() * 9999);
let orderId = "";
let caseId = "";
let caseNumber = "";
const status = async () => (await sql`select status from service_cases where id = ${caseId}`)[0].status;
const move = (who: Parameters<typeof call>[0], body: object) => call(who, `/api/cases/${caseId}/status`, body, "PATCH");

beforeAll(async () => {
  const [org] = await sql`select id from organizations where slug = 'demo-electronics'`;
  const [cust] = await sql`select c.id from customers c join users u on u.id = c.user_id where u.email = 'customer@relaycare.test'`;
  const [o] = await sql`insert into orders (organization_id, customer_id, wc_order_id, order_number, wc_status, ordered_at)
    values (${org.id}, ${cust.id}, ${WC_ORDER}, ${String(WC_ORDER)}, 'completed', now()) returning id`;
  orderId = o.id;
  const [item] = await sql`insert into order_items (order_id, wc_line_item_id, name, sku) values (${o.id}, 1, 'Journey Washer', 'JW-1') returning id`;
  const created = await call("customer", "/api/cases", { orderItemId: item.id, category: "not_working", description: "Water leaks during the wash cycle." });
  caseId = created.body.caseId;
  caseNumber = created.body.caseNumber;
  for (const to of ["under_triage", "warranty_review"]) await move("maya", { to });
  await call("maya", `/api/cases/${caseId}/warranty`, { status: "eligible" });
  await call("maya", `/api/cases/${caseId}/handoff`, { symptoms: ["Leak during wash"], actionRequired: "Inspect drain connection." });
  const ravi = (await sql`select id from users where email = 'ravi@relaycare.test'`)[0].id;
  expect((await call("arjun", `/api/cases/${caseId}/assign`, { technicianId: ravi })).status).toBe(201);
});

afterAll(async () => {
  try {
    await dismissGroup(caseNumber.toLowerCase().replace(/[^a-z0-9]/g, ""));
  } catch {
    // group may not have been created
  }
  const files = await sql`select object_key from case_attachments where case_id = ${caseId}`;
  if (files.length) {
    await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!).storage.from("case-evidence").remove(files.map((f) => f.object_key));
  }
  await sql`delete from jobs where payload->>'caseId' = ${caseId}`;
  await deleteCases([caseId]);
  await sql`delete from warranties where order_item_id in (select id from order_items where order_id = ${orderId})`;
  await sql`delete from order_items where order_id = ${orderId}`;
  await sql`delete from orders where id = ${orderId}`;
  await sql.end();
});

const report = { resolutionType: "repair", findings: "Drain hose clamp loose.", workPerformed: "Replaced clamp, ran a test wash, no leak.", partsReplaced: ["Hose clamp"] };

describe("technician completes the job", () => {
  it("accepts with a visit time, then starts work", async () => {
    expect((await call("ravi", `/api/cases/${caseId}/assignment`, { action: "accept", scheduledAt: new Date(Date.now() + 3_600_000).toISOString() })).status).toBe(200);
    expect(await status()).toBe("scheduled");
    expect((await move("arjun", { to: "in_progress" })).status).toBe(403); // only the technician starts work
    expect((await move("ravi", { to: "in_progress" })).status).toBe(200);
  });

  it("cannot finish without a repair photo, or close/resolve the case himself", async () => {
    expect((await call("ravi", `/api/cases/${caseId}/resolution`, report)).status).toBe(422);
    expect((await move("ravi", { to: "resolved" })).status).toBe(409);
    expect((await move("ravi", { to: "closed" })).status).toBe(409);
    expect((await call("maya", `/api/cases/${caseId}/resolution`, report)).status).toBe(403);
    expect(await status()).toBe("in_progress");
  });

  it("files the report once a photo is uploaded; the customer is asked to confirm", async () => {
    const bytes = Buffer.from(`repair-${Date.now()}`);
    const meta = { fileName: "after-repair.jpg", mimeType: "image/jpeg", sizeBytes: bytes.length };
    const up = await call("ravi", `/api/cases/${caseId}/attachments`, { intent: "upload", ...meta });
    const put = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      .storage.from("case-evidence")
      .uploadToSignedUrl(up.body.path, up.body.token, bytes, { contentType: "image/jpeg" });
    expect(put.error).toBeNull();
    expect((await call("ravi", `/api/cases/${caseId}/attachments`, { intent: "register", ...meta, objectKey: up.body.objectKey })).status).toBe(201);

    expect((await call("ravi", `/api/cases/${caseId}/resolution`, report)).status).toBe(200);
    expect(await status()).toBe("resolution_pending");
    const [c] = await sql`select resolution_type, u.name owner from service_cases c left join users u on u.id = c.current_owner_id where c.id = ${caseId}`;
    expect(c).toEqual({ resolution_type: "repair", owner: "Demo Customer" });
    const [a] = await sql`select assignment_status, report->>'findings' findings from case_assignments where case_id = ${caseId} and assignment_status = 'completed'`;
    expect(a.findings).toBe(report.findings);
  });
});

describe("a chat message is not a business operation", () => {
  const signed = (body: string) => {
    const nonce = randomBytes(9).toString("hex");
    const timestamp = String(Date.now());
    const signature = createHash("sha1").update(process.env.NEXCONN_APP_SECRET! + nonce + timestamp).digest("hex");
    return { "Content-Type": "application/json", AppKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY!, Nonce: nonce, Timestamp: timestamp, Signature: signature };
  };

  it("a signed 'done' message from the technician is recorded but changes nothing", async () => {
    const group = caseNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ravi = (await sql`select nexconn_user_id from users where email = 'ravi@relaycare.test'`)[0].nexconn_user_id;
    const id = `test-${Date.now()}`;
    const body = JSON.stringify({ type: "message:send", id, time: Date.now(), data: [{ fromUserId: ravi, toChannelIds: [group], content: JSON.stringify({ content: "done" }) }] });
    const post = (b: string, headers: Record<string, string>) => fetch(`${BASE_URL}/api/webhooks/nexconn`, { method: "POST", body: b, headers }).then(async (r) => ({ status: r.status, body: await r.json() }));

    expect((await post(body, { ...signed(body), Signature: "forged" })).status).toBe(401);
    expect((await post(body, signed(body))).body).toEqual({ ok: true, duplicate: false });
    expect((await post(body, signed(body))).body).toEqual({ ok: true, duplicate: true });
    await fetch(`${BASE_URL}/api/jobs/run`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });

    expect(await status()).toBe("resolution_pending");
    const [t] = await sql`select last_message_at from chat_threads where case_id = ${caseId} and thread_type = 'group'`;
    expect(t?.last_message_at).not.toBeNull();
    await sql`delete from nexconn_events where id = ${id}`;
  });
});

describe("customer confirms, merchant closes", () => {
  it("only the customer can confirm; rating needs a resolved case", async () => {
    expect((await call("customer", `/api/cases/${caseId}/feedback`, { score: 5 })).status).toBe(409);
    expect((await move("maya", { to: "resolved" })).status).toBe(403);
    expect((await move("customer", { to: "resolved" })).status).toBe(200);
    expect((await call("customer", `/api/cases/${caseId}/feedback`, { score: 5, comment: "Fast and polite" })).status).toBe(200);
  });

  it("the merchant closes; the full history stays linked to the purchase", async () => {
    expect((await move("customer", { to: "closed" })).status).toBe(403);
    expect((await move("maya", { to: "closed" })).status).toBe(200);
    const [c] = await sql`select status, csat_score, closed_at, resolved_at, order_id from service_cases where id = ${caseId}`;
    expect(c).toMatchObject({ status: "closed", csat_score: 5, order_id: orderId });
    expect(c.closed_at).not.toBeNull();
    const events = (await sql`select event_type from case_events where case_id = ${caseId} order by created_at`).map((e) => e.event_type);
    for (const e of ["case_created", "handoff_created", "technician_assigned", "assignment_accepted", "visit_scheduled", "evidence_added", "work_completed", "feedback_given"]) {
      expect(events).toContain(e);
    }
  });
});
