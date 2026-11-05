import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sessionCookie } from "../helpers/session";
import { BASE_URL, call, deleteCases, sql } from "../helpers/api";

vi.mock("server-only", () => ({}));
const { dismissGroup, listGroupMembers } = await import("@/lib/nexconn/server");

/**
 * Spec Journey D + critical tests "Backend can create a Nexconn group", "A fourth user can join",
 * "Never let a technician view another technician's assignments". Uses the real Nexconn API.
 */
const WC_ORDER = 970000 + Math.floor(Math.random() * 9999);
const TECH2_EMAIL = `tech2-${Date.now()}@relaycare.test`;
const PASSWORD = "relaycare-demo-2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let orderId = "";
let caseId = "";
let caseNumber = "";
let tech2 = { id: "", authId: "", cookie: "" };

const nexconnId = async (email: string) => (await sql`select nexconn_user_id from users where email = ${email}`)[0]?.nexconn_user_id as string;
const status = async () => (await sql`select status from service_cases where id = ${caseId}`)[0].status;
const waitForJobs = async () => {
  for (let i = 0; i < 40; i++) {
    const [p] = await sql`select count(*)::int n from jobs where type = 'nexconn.group.sync' and payload->>'caseId' = ${caseId} and status in ('pending', 'running')`;
    if (!p.n) return;
    await fetch(`${BASE_URL}/api/jobs/run`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("group sync jobs did not finish");
};

beforeAll(async () => {
  const [org] = await sql`select id from organizations where slug = 'demo-electronics'`;
  // A second technician who can sign in, for reassignment tests.
  const { data, error } = await admin.auth.admin.createUser({ email: TECH2_EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const [u] = await sql`insert into users (auth_user_id, name, email, locale) values (${data.user.id}, 'Tech Two', ${TECH2_EMAIL}, 'en') returning id`;
  await sql`insert into organization_memberships (organization_id, user_id, role) values (${org.id}, ${u.id}, 'technician')`;
  tech2 = { id: u.id, authId: data.user.id, cookie: await sessionCookie(TECH2_EMAIL, PASSWORD) };

  // A case that has reached dispatch the normal way.
  const [cust] = await sql`select c.id from customers c join users us on us.id = c.user_id where us.email = 'customer@relaycare.test'`;
  const [o] = await sql`insert into orders (organization_id, customer_id, wc_order_id, order_number, wc_status, ordered_at)
    values (${org.id}, ${cust.id}, ${WC_ORDER}, ${String(WC_ORDER)}, 'completed', now()) returning id`;
  orderId = o.id;
  const [item] = await sql`insert into order_items (order_id, wc_line_item_id, name, sku) values (${o.id}, 1, 'Dispatch Dryer', 'DD-1') returning id`;
  const created = await call("customer", "/api/cases", { orderItemId: item.id, category: "not_working", description: "Drum does not turn at all." });
  caseId = created.body.caseId;
  caseNumber = created.body.caseNumber;
  for (const to of ["under_triage", "warranty_review"]) expect((await call("maya", `/api/cases/${caseId}/status`, { to }, "PATCH")).status).toBe(200);
  expect((await call("maya", `/api/cases/${caseId}/warranty`, { status: "eligible" })).status).toBe(200);
  expect((await call("maya", `/api/cases/${caseId}/handoff`, { symptoms: ["Drum does not turn"], actionRequired: "Check the drive belt and motor." })).status).toBe(201);
});

afterAll(async () => {
  try {
    await dismissGroup(caseNumber.toLowerCase().replace(/[^a-z0-9]/g, ""));
  } catch {
    // group may not exist if a test failed early
  }
  await sql`delete from jobs where payload->>'caseId' = ${caseId}`;
  await deleteCases([caseId]);
  await sql`delete from warranties where order_item_id in (select id from order_items where order_id = ${orderId})`;
  await sql`delete from order_items where order_id = ${orderId}`;
  await sql`delete from orders where id = ${orderId}`;
  await sql`delete from technician_profiles where user_id = ${tech2.id}`;
  await sql`delete from organization_memberships where user_id = ${tech2.id}`;
  await sql`delete from users where id = ${tech2.id}`;
  await admin.auth.admin.deleteUser(tech2.authId);
  await sql.end();
});

const raviId = async () => (await sql`select id from users where email = 'ravi@relaycare.test'`)[0].id as string;
const assign = (who: Parameters<typeof call>[0], body: object) => call(who, `/api/cases/${caseId}/assign`, body);
const asTech2 = (path: string, body: object) =>
  fetch(BASE_URL + path, { method: "POST", headers: { "Content-Type": "application/json", cookie: tech2.cookie }, body: JSON.stringify(body) }).then((r) => r.status);

describe("assigning", () => {
  it("only dispatch or the owner can assign; only technicians can be assigned", async () => {
    const technicianId = await raviId();
    expect((await assign("maya", { technicianId })).status).toBe(403);
    expect((await assign("customer", { technicianId })).status).toBe(403);
    expect((await assign("ravi", { technicianId })).status).toBe(404); // can't even see the case yet
    const mayaId = (await sql`select id from users where email = 'maya@relaycare.test'`)[0].id;
    expect((await assign("arjun", { technicianId: mayaId })).status).toBe(400);
    expect((await assign("arjun", { technicianId, scheduledAt: "2020-01-01T10:00:00Z" })).status).toBe(400);
  });

  it("assigns Ravi, hands him the context and opens the case to him", async () => {
    const res = await assign("arjun", { technicianId: await raviId() });
    expect(res.status).toBe(201);
    expect(await status()).toBe("assigned");
    const [h] = await sql`select context_snapshot s from case_handoffs h join users u on u.id = h.to_user_id where h.case_id = ${caseId} and u.email = 'ravi@relaycare.test'`;
    expect(h.s.actionRequired).toBe("Check the drive belt and motor.");
    expect((await call("ravi", `/api/cases/${caseId}/attachments`, { intent: "upload", fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 5 })).status).toBe(200);
    expect((await assign("arjun", { technicianId: await raviId() })).status).toBe(409);
  });

  it("creates the real Nexconn group with customer, agent, dispatcher and technician", async () => {
    await waitForJobs();
    const [t] = await sql`select nexconn_group_id from chat_threads where case_id = ${caseId} and thread_type = 'group'`;
    expect(t.nexconn_group_id).toBe(caseNumber.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const members = await listGroupMembers(t.nexconn_group_id);
    for (const email of ["customer@relaycare.test", "maya@relaycare.test", "arjun@relaycare.test", "ravi@relaycare.test"]) {
      expect(members).toContain(await nexconnId(email));
    }
  });
});

describe("reassigning", () => {
  it("moves the job to another technician, keeps history, and cuts Ravi off", async () => {
    const res = await assign("arjun", { technicianId: tech2.id, note: "Ravi is on leave", reassign: true });
    expect(res.status).toBe(201);
    const history = await sql`select u.name, a.assignment_status from case_assignments a join users u on u.id = a.technician_id where a.case_id = ${caseId} order by a.created_at`;
    expect(history.map((h) => `${h.name}:${h.assignment_status}`)).toEqual(["Ravi:cancelled", "Tech Two:assigned"]);
    expect((await call("ravi", `/api/cases/${caseId}/attachments`, { intent: "upload", fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 5 })).status).toBe(404);
    await waitForJobs();
    const members = await listGroupMembers(caseNumber.toLowerCase().replace(/[^a-z0-9]/g, ""));
    expect(members).not.toContain(await nexconnId("ravi@relaycare.test"));
    expect(members).toContain(await nexconnId(TECH2_EMAIL));
  });

  it("the new technician accepts and books the visit", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(await asTech2(`/api/cases/${caseId}/assignment`, { action: "accept", scheduledAt: tomorrow })).toBe(200);
    expect(await status()).toBe("scheduled");
    const [a] = await sql`select assignment_status, accepted_at, scheduled_at from case_assignments where case_id = ${caseId} and technician_id = ${tech2.id}`;
    expect(a.assignment_status).toBe("accepted");
    expect(a.accepted_at).not.toBeNull();
    const [h] = await sql`select acknowledged_at from case_handoffs where case_id = ${caseId} and to_user_id = ${tech2.id}`;
    expect(h.acknowledged_at).not.toBeNull();
  });

  it("a technician who declines sends the case back to dispatch and loses access", async () => {
    expect((await assign("arjun", { technicianId: await raviId() })).status).toBe(409); // must say reassign
    expect((await assign("arjun", { technicianId: await raviId(), reassign: true })).status).toBe(201);
    expect((await call("ravi", `/api/cases/${caseId}/assignment`, { action: "reject" })).status).toBe(400);
    expect((await call("ravi", `/api/cases/${caseId}/assignment`, { action: "reject", reason: "No spare belt in stock" })).status).toBe(200);
    expect(await status()).toBe("awaiting_assignment");
    expect((await call("ravi", `/api/cases/${caseId}/attachments`, { intent: "upload", fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 5 })).status).toBe(404);
    expect(await asTech2(`/api/cases/${caseId}/assignment`, { action: "accept" })).toBe(404); // tech2 was reassigned away
  });
});

describe("concurrency", () => {
  it("two simultaneous assignments produce exactly one active assignment", async () => {
    const [a, b] = await Promise.all([assign("arjun", { technicianId: await raviId() }), assign("owner", { technicianId: tech2.id })]);
    expect([a.status, b.status].sort()).toEqual([201, 409].sort());
    const [n] = await sql`select count(*)::int n from case_assignments where case_id = ${caseId} and assignment_status in ('assigned', 'accepted')`;
    expect(n.n).toBe(1);
  });
});
