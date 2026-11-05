import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, deleteCases, sql } from "../helpers/api";

/**
 * Spec Journey C on the real API: triage → request info → warranty → handoff → dispatch,
 * plus escalation, with role checks and preconditions at every step.
 */
const WC_ORDER = 980000 + Math.floor(Math.random() * 9999);
let orderId = "";
let caseId = "";

beforeAll(async () => {
  const [org] = await sql`select id from organizations where slug = 'demo-electronics'`;
  const [cust] = await sql`select c.id from customers c join users u on u.id = c.user_id where u.email = 'customer@relaycare.test'`;
  const [o] = await sql`insert into orders (organization_id, customer_id, wc_order_id, order_number, wc_status, ordered_at, shipping_address)
    values (${org.id}, ${cust.id}, ${WC_ORDER}, ${String(WC_ORDER)}, 'completed', now(), ${sql.json({ line1: "12 Riverfront Road", city: "Ahmedabad", postcode: "380009", phone: "+91 98765 43210" })}) returning id`;
  orderId = o.id;
  const [item] = await sql`insert into order_items (order_id, wc_line_item_id, name, sku, serial_number) values (${o.id}, 1, 'Workflow Washer', 'AW7-WF', 'WF-001') returning id`;
  const res = await call("customer", "/api/cases", { orderItemId: item.id, category: "not_working", description: "Water leaks during the wash cycle.", troubleshooting: ["Checked inlet pipe"] });
  expect(res.status).toBe(201);
  caseId = res.body.caseId;
});

afterAll(async () => {
  await deleteCases([caseId]);
  await sql`delete from warranties where order_item_id in (select id from order_items where order_id = ${orderId})`;
  await sql`delete from order_items where order_id = ${orderId}`;
  await sql`delete from orders where id = ${orderId}`;
  await sql.end();
});

const move = (who: Parameters<typeof call>[0], body: object) => call(who, `/api/cases/${caseId}/status`, body, "PATCH");
const state = async () => (await sql`select c.status, u.name owner from service_cases c left join users u on u.id = c.current_owner_id where c.id = ${caseId}`)[0];

describe("triage", () => {
  it("only staff can start triage; illegal jumps are refused", async () => {
    expect((await move("customer", { to: "under_triage" })).status).toBe(403);
    expect((await move("ravi", { to: "under_triage" })).status).toBe(404);
    expect((await move("maya", { to: "closed" })).status).toBe(409);
    expect((await move("maya", { to: "under_triage" })).status).toBe(200);
    expect(await state()).toEqual({ status: "under_triage", owner: "Maya" });
  });

  it("requesting info needs a reason and hands the case to the customer", async () => {
    expect((await move("maya", { to: "awaiting_customer" })).status).toBe(422);
    expect((await move("maya", { to: "awaiting_customer", reason: "Please send a photo of the leak." })).status).toBe(200);
    expect(await state()).toEqual({ status: "awaiting_customer", owner: "Demo Customer" });
    expect((await move("customer", { to: "under_triage" })).status).toBe(200);
    expect(await state()).toEqual({ status: "under_triage", owner: "Maya" });
  });
});

describe("warranty and handoff", () => {
  const handoff = { symptoms: ["Leak during wash cycle", "Water near bottom panel"], troubleshooting: ["Customer checked inlet pipe"], actionRequired: "Inspect drain connection and internal water path.", priority: "high" };

  it("reaches warranty review", async () => {
    expect((await move("maya", { to: "warranty_review" })).status).toBe(200);
  });

  it("cannot dispatch before the warranty is verified, and nothing is half-saved", async () => {
    const res = await call("maya", `/api/cases/${caseId}/handoff`, handoff);
    expect(res.status).toBe(422);
    expect((await sql`select count(*)::int n from case_handoffs where case_id = ${caseId}`)[0].n).toBe(0);
  });

  it("only staff record warranty decisions; exceptions need a reason", async () => {
    expect((await call("customer", `/api/cases/${caseId}/warranty`, { status: "eligible" })).status).toBe(403);
    expect((await call("maya", `/api/cases/${caseId}/warranty`, { status: "exception" })).status).toBe(400);
    expect((await call("maya", `/api/cases/${caseId}/warranty`, { status: "eligible", notes: "Within 12 months of delivery" })).status).toBe(200);
    expect((await sql`select warranty_status from service_cases where id = ${caseId}`)[0].warranty_status).toBe("eligible");
  });

  it("handoff snapshot carries the full context and moves the case to dispatch", async () => {
    expect((await call("customer", `/api/cases/${caseId}/handoff`, handoff)).status).toBe(403);
    const res = await call("maya", `/api/cases/${caseId}/handoff`, handoff);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("awaiting_assignment");
    const [h] = await sql`select context_snapshot s from case_handoffs where case_id = ${caseId}`;
    expect(h.s).toMatchObject({
      version: 1,
      product: "Workflow Washer",
      serialNumber: "WF-001",
      complaint: "Water leaks during the wash cycle.",
      symptoms: handoff.symptoms,
      actionRequired: handoff.actionRequired,
      priority: "high",
      preparedBy: "Maya",
      customer: { name: "Demo Customer", phone: "+91 98765 43210" },
    });
    expect(h.s.warranty).toMatch(/^Verified by merchant/);
    expect(await state()).toEqual({ status: "awaiting_assignment", owner: null });
  });
});

describe("escalation", () => {
  it("anyone on staff can escalate with a reason; only dispatch restores", async () => {
    expect((await move("maya", { to: "escalated" })).status).toBe(422);
    expect((await move("maya", { to: "escalated", reason: "Customer reports repeated leak" })).status).toBe(200);
    expect((await move("maya", { to: "awaiting_assignment" })).status).toBe(403);
    expect((await move("arjun", { to: "awaiting_assignment" })).status).toBe(200);
    expect((await sql`select escalated_from_status from service_cases where id = ${caseId}`)[0].escalated_from_status).toBeNull();
  });
});

describe("audit trail", () => {
  it("every step is an appended event, in order", async () => {
    const events = await sql`select event_type, old_status, new_status from case_events where case_id = ${caseId} order by created_at`;
    expect(events.map((e) => e.new_status ?? e.event_type)).toEqual([
      "submitted", "under_triage", "awaiting_customer", "under_triage", "warranty_review",
      "warranty_verified", "handoff_created", "awaiting_assignment", "escalated", "awaiting_assignment",
    ]);
  });

  it("the database refuses illegal transitions and event edits even from the owner connection", async () => {
    await expect(sql`update service_cases set status = 'closed' where id = ${caseId}`).rejects.toThrow(/Illegal case transition/);
    await expect(sql`update case_events set event_type = 'x' where case_id = ${caseId}`).rejects.toThrow(/append-only/);
  });
});
