import { describe, expect, it } from "vitest";
import fixture from "../fixtures/wc-order-10842.json";
import { normalizeOrder } from "@/lib/woocommerce/normalize";
import { matchPolicy, suggestWarranty, type Policy } from "@/lib/warranty";

const KEYS = ["_serial_number", "serial_number"];

describe("normalizeOrder (real WooCommerce payload)", () => {
  const n = normalizeOrder(fixture, KEYS);

  it("maps order, customer and item", () => {
    expect(n.order).toMatchObject({ wcOrderId: 10842, orderNumber: "10842", wcStatus: "completed", currency: "INR", total: "18999.00" });
    expect(n.order.orderedAt?.toISOString()).toBe("2026-10-20T11:30:00.000Z");
    expect(n.customer).toMatchObject({ email: "customer@relaycare.test", name: "Demo Customer" });
    expect(n.customer.wcCustomerId).toBeGreaterThan(0);
    expect(n.items).toHaveLength(1);
    expect(n.items[0]).toMatchObject({ name: "AquaWash 7kg", sku: "AW7-7KG", quantity: 1, serialNumber: "AW7-DEMO-0042" });
  });

  it("treats customer_id 0 as a guest keyed by email", () => {
    const guest = normalizeOrder({ ...fixture, customer_id: 0, billing: { ...fixture.billing, email: " Guest@Example.COM " } }, KEYS);
    expect(guest.customer.wcCustomerId).toBeNull();
    expect(guest.customer.email).toBe("guest@example.com");
  });

  it("leaves serial empty when no configured meta key is present", () => {
    expect(normalizeOrder(fixture, ["imei"]).items[0].serialNumber).toBeNull();
  });

  it("rejects malformed payloads and orders without an email", () => {
    expect(() => normalizeOrder({ id: "x" }, KEYS)).toThrow();
    expect(() => normalizeOrder({ ...fixture, billing: { ...fixture.billing, email: "" } }, KEYS)).toThrow(/billing email/);
  });
});

describe("warranty suggestion", () => {
  const p = (o: Partial<Policy>): Policy => ({ id: "p", matchType: "all", matchValue: null, durationMonths: 12, startBasis: "completed", priority: 0, isActive: true, ...o });
  const policies = [p({ id: "default" }), p({ id: "aquawash", matchType: "sku_prefix", matchValue: "aw7", priority: 10 }), p({ id: "off", priority: 99, isActive: false })];

  it("picks the highest-priority active match", () => {
    expect(matchPolicy(policies, { productId: 1, sku: "AW7-7KG" })?.id).toBe("aquawash");
    expect(matchPolicy(policies, { productId: 1, sku: "TV-55" })?.id).toBe("default");
    expect(matchPolicy([], { productId: 1, sku: null })).toBeNull();
  });

  it("starts at completion and adds calendar months", () => {
    const s = suggestWarranty(policies[1], { orderedAt: new Date("2026-10-20T11:30:00Z"), completedAt: new Date("2026-10-22T16:00:00Z") });
    expect(s).toMatchObject({ startsAt: "2026-10-22", expiresAt: "2027-10-22", durationMonths: 12 });
  });

  it("falls back to order date when the order is not completed", () => {
    expect(suggestWarranty(policies[1], { orderedAt: new Date("2026-01-31T00:00:00Z"), completedAt: null })?.startsAt).toBe("2026-01-31");
  });
});
