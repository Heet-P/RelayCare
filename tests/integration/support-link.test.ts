import { afterAll, describe, expect, it, vi } from "vitest";
import { as, BASE_URL, sql } from "../helpers/api";

vi.mock("server-only", () => ({}));
const { decrypt } = await import("@/lib/crypto");
const { signSupportLink } = await import("@/lib/woocommerce/support-link");

afterAll(() => sql.end());

/** The store's Get Support button: a signed link that still requires email verification. */
describe("Get Support links", async () => {
  const [integration] = await sql`select id, link_secret_encrypted from store_integrations limit 1`;
  const [order] = await sql`select id from orders where wc_order_id = 10842`;
  const secret = decrypt(integration.link_secret_encrypted);
  const link = (over: Partial<Record<"o" | "e" | "exp", string>> = {}) => {
    const p = { i: integration.id, o: "10842", e: "customer@relaycare.test", exp: String(Math.floor(Date.now() / 1000) + 600), ...over };
    return `${BASE_URL}/support/start?${new URLSearchParams({ ...p, sig: signSupportLink(secret, p) })}`;
  };
  const go = async (url: string, cookie = "") => {
    const r = await fetch(url, { redirect: "manual", headers: { cookie } });
    return decodeURIComponent(r.headers.get("location") ?? "");
  };

  it("signed-out customer is sent to email verification, email pre-filled, order remembered", async () => {
    const to = await go(link());
    expect(to).toContain("/verify?email=customer@relaycare.test");
    expect(to).toContain(`next=/support/new?order=${order.id}`);
  });

  it("signed-in customer with the same email goes straight to the order", async () => {
    expect(await go(link(), await as("customer"))).toContain(`/support/new?order=${order.id}`);
  });

  it("someone signed in with a different email must still verify the link's email", async () => {
    expect(await go(link(), await as("maya"))).toContain("/verify?email=customer@relaycare.test");
  });

  it("tampered, expired or unsigned links fall back to plain sign-in", async () => {
    const tampered = link().replace("o=10842", "o=10843");
    expect(await go(tampered)).toMatch(/\/verify$/);
    expect(await go(link({ exp: String(Math.floor(Date.now() / 1000) - 5) }))).toMatch(/\/verify$/);
    expect(await go(`${BASE_URL}/support/start?i=${integration.id}&o=10842`)).toMatch(/\/verify$/);
  });
});
