import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE_URL, call, deleteCases, sql, type Who } from "../helpers/api";

/**
 * Spec §14 critical tests: "A customer can access only their own order",
 * "Unauthorised users cannot access a case", plus evidence and staff-endpoint boundaries.
 */
const WC_ORDER = 990000 + Math.floor(Math.random() * 9999);
let itemId = "";
let othersItemId = "";
let orderId = "";
const caseIds: string[] = [];

beforeAll(async () => {
  // A fresh purchase for the demo customer, so the test never collides with demo cases.
  const [org] = await sql`select id from organizations where slug = 'demo-electronics'`;
  const [cust] = await sql`select c.id from customers c join users u on u.id = c.user_id where u.email = 'customer@relaycare.test'`;
  const [o] = await sql`insert into orders (organization_id, customer_id, wc_order_id, order_number, wc_status, ordered_at)
    values (${org.id}, ${cust.id}, ${WC_ORDER}, ${String(WC_ORDER)}, 'completed', now()) returning id`;
  orderId = o.id;
  const [i] = await sql`insert into order_items (order_id, wc_line_item_id, name, sku) values (${o.id}, 1, 'Test Fridge', 'TF-1') returning id`;
  itemId = i.id;
  // An item that belongs to a different customer (guest order from the store).
  const [other] = await sql`select oi.id from order_items oi join orders o on o.id = oi.order_id
    join customers c on c.id = o.customer_id where c.user_id is null limit 1`;
  othersItemId = other?.id ?? "00000000-0000-4000-8000-000000000000";
});

afterAll(async () => {
  await deleteCases(caseIds);
  await sql`delete from order_items where order_id = ${orderId}`;
  await sql`delete from orders where id = ${orderId}`;
  await sql.end();
});

const report = () => ({ orderItemId: itemId, category: "not_working", description: "Integration test: unit does not cool.", troubleshooting: ["Unplugged for 5 minutes"] });

describe("case creation", () => {
  it("rejects anonymous, staff without the purchase, and other customers' items", async () => {
    expect((await call("anonymous", "/api/cases", report())).status).toBe(401);
    expect((await call("maya", "/api/cases", report())).status).toBe(404);
    expect((await call("customer", "/api/cases", { ...report(), orderItemId: othersItemId })).status).toBe(404);
  });

  it("validates input", async () => {
    expect((await call("customer", "/api/cases", { ...report(), description: "short" })).status).toBe(400);
    expect((await call("customer", "/api/cases", { ...report(), category: "made_up" })).status).toBe(400);
  });

  it("creates one case per product and assigns an agent", async () => {
    const res = await call("customer", "/api/cases", report());
    expect(res.status).toBe(201);
    expect(res.body.caseNumber).toMatch(/^RC-\d{4}-\d{4}$/);
    caseIds.push(res.body.caseId);
    const [c] = await sql`select status, assigned_agent_id from service_cases where id = ${res.body.caseId}`;
    expect(c.status).toBe("submitted");
    expect(c.assigned_agent_id).not.toBeNull();
    expect((await call("customer", "/api/cases", report())).status).toBe(409);
  });
});

describe("case access matrix", () => {
  const meta = { intent: "upload", fileName: "x.jpg", mimeType: "image/jpeg", sizeBytes: 10 };
  const expected: [Who, number][] = [
    ["customer", 200],
    ["owner", 200],
    ["maya", 200],
    ["arjun", 200],
    ["ravi", 404], // technician not assigned: the case does not exist for him
    ["anonymous", 401],
  ];
  for (const [who, status] of expected) {
    it(`${who} → ${status}`, async () => {
      expect((await call(who, `/api/cases/${caseIds[0]}/attachments`, meta)).status).toBe(status);
    });
  }
  it("malformed and unknown case ids are 404", async () => {
    expect((await call("customer", `/api/cases/not-a-uuid/attachments`, meta)).status).toBe(404);
    expect((await call("owner", `/api/cases/00000000-0000-4000-8000-000000000000/attachments`, meta)).status).toBe(404);
  });
});

describe("evidence", () => {
  const bytes = Buffer.from(`integration-${Date.now()}`);
  const meta = { fileName: "leak.jpg", mimeType: "image/jpeg", sizeBytes: bytes.length };
  let attachmentId = "";

  it("rejects oversize files and keys outside the case", async () => {
    expect((await call("customer", `/api/cases/${caseIds[0]}/attachments`, { intent: "upload", ...meta, sizeBytes: 11 * 1024 * 1024 })).status).toBe(413);
    expect((await call("customer", `/api/cases/${caseIds[0]}/attachments`, { intent: "register", ...meta, objectKey: "other/case/x.jpg" })).status).toBe(400);
  });

  it("uploads, verifies size, registers, and serves only to case members", async () => {
    const up = await call("customer", `/api/cases/${caseIds[0]}/attachments`, { intent: "upload", ...meta });
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage;
    const put = await storage.from("case-evidence").uploadToSignedUrl(up.body.path, up.body.token, bytes, { contentType: "image/jpeg" });
    expect(put.error).toBeNull();

    expect((await call("customer", `/api/cases/${caseIds[0]}/attachments`, { intent: "register", ...meta, sizeBytes: 1, objectKey: up.body.objectKey })).status).toBe(400);
    const reg = await call("customer", `/api/cases/${caseIds[0]}/attachments`, { intent: "register", ...meta, objectKey: up.body.objectKey });
    expect(reg.status).toBe(201);
    attachmentId = reg.body.attachmentId;

    const ok = await call("customer", `/api/attachments/${attachmentId}`);
    expect(ok.status).toBe(302);
    expect(Buffer.from(await (await fetch(ok.location!)).arrayBuffer()).equals(bytes)).toBe(true);
    expect((await call("maya", `/api/attachments/${attachmentId}`)).status).toBe(302);
    expect((await call("ravi", `/api/attachments/${attachmentId}`)).status).toBe(404);
    expect((await call("anonymous", `/api/attachments/${attachmentId}`)).status).toBe(401);
  });

  afterAll(async () => {
    const files = await sql`select object_key from case_attachments where case_id in ${sql(caseIds)}`;
    if (files.length) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await admin.storage.from("case-evidence").remove(files.map((f) => f.object_key));
    }
  });
});

describe("staff-only and machine endpoints", () => {
  it("only the owner may connect a store", async () => {
    expect((await call("anonymous", "/api/integrations/woocommerce/connect", {})).status).toBe(401);
    for (const who of ["maya", "arjun", "ravi", "customer"] as const) {
      expect((await call(who, "/api/integrations/woocommerce/connect", {})).status).toBe(403);
    }
    expect((await call("owner", "/api/integrations/woocommerce/connect", {})).status).toBe(400); // allowed, invalid body
  });

  it("job runner requires the cron secret", async () => {
    expect((await fetch(`${BASE_URL}/api/jobs/run`, { method: "POST" })).status).toBe(401);
    expect((await fetch(`${BASE_URL}/api/jobs/run`, { method: "POST", headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
  });

  it("webhooks reject unknown integrations and bad signatures, accept pings", async () => {
    const [integration] = await sql`select id from store_integrations limit 1`;
    const post = (id: string, headers: Record<string, string>, body = "{}") =>
      fetch(`${BASE_URL}/api/webhooks/woocommerce/${id}`, { method: "POST", headers, body }).then((r) => r.status);
    expect(await post("00000000-0000-4000-8000-000000000000", {})).toBe(404);
    expect(await post(integration.id, { "x-wc-webhook-topic": "order.updated", "x-wc-webhook-signature": "bad" })).toBe(401);
    expect(await post(integration.id, { "content-type": "application/x-www-form-urlencoded" }, "webhook_id=1")).toBe(200);
  });
});
