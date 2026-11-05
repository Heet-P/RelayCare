import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifySupportLink } = await import("@/lib/woocommerce/support-link");

// Mirrors relaycare_support_url() in the WordPress plugin (PHP hash_hmac sha256, hex).
const php = (secret: string, i: string, o: string, e: string, exp: string) =>
  createHmac("sha256", secret).update(`${i}|${o}|${e}|${exp}`).digest("hex");

describe("Get Support links", () => {
  const exp = String(Math.floor(Date.now() / 1000) + 600);
  const link = { i: "int-1", o: "10842", e: "customer@relaycare.test", exp, sig: php("s3cret", "int-1", "10842", "customer@relaycare.test", exp) };

  it("accepts links signed like the plugin does", () => expect(verifySupportLink("s3cret", link)).toBe(true));
  it("rejects tampered order, email, secret or expiry", () => {
    expect(verifySupportLink("s3cret", { ...link, o: "10843" })).toBe(false);
    expect(verifySupportLink("s3cret", { ...link, e: "attacker@example.com" })).toBe(false);
    expect(verifySupportLink("other", link)).toBe(false);
    expect(verifySupportLink("s3cret", link, (Number(exp) + 1) * 1000)).toBe(false);
  });
});
