import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyWooSignature } = await import("@/lib/woocommerce/signature");
const { signedHeaders, verifyNexconnWebhook } = await import("@/lib/nexconn/signature");
const { encrypt, decrypt } = await import("@/lib/crypto");

describe("WooCommerce signature", () => {
  const secret = "whsec_test";
  const raw = '{"id":10842,"number":"10842","total":"18999.00"}';
  const sig = createHmac("sha256", secret).update(raw).digest("base64");

  it("accepts the signature of the raw body", () => {
    expect(verifyWooSignature(secret, raw, sig)).toBe(true);
  });
  it("rejects re-serialised JSON, tampering, wrong secret and missing header", () => {
    expect(verifyWooSignature(secret, JSON.stringify(JSON.parse(raw), null, 1), sig)).toBe(false);
    expect(verifyWooSignature(secret, raw.replace("18999", "1"), sig)).toBe(false);
    expect(verifyWooSignature("other", raw, sig)).toBe(false);
    expect(verifyWooSignature(secret, raw, null)).toBe(false);
  });
});

describe("Nexconn signature", () => {
  const secret = "appsecret";
  it("signs as sha1(secret+nonce+timestamp) with an 18-char nonce", () => {
    const h = signedHeaders("key", secret, 1_700_000_000_000);
    expect(h.Nonce).toHaveLength(18);
    expect(h.Signature).toBe(createHash("sha1").update(secret + h.Nonce + h.Timestamp).digest("hex"));
  });
  it("verifies webhooks and rejects stale or forged ones", () => {
    const now = Date.now();
    const h = signedHeaders("key", secret, now);
    const hdr = { nonce: h.Nonce, timestamp: h.Timestamp, signature: h.Signature };
    expect(verifyNexconnWebhook(secret, hdr, now)).toBe(true);
    expect(verifyNexconnWebhook(secret, hdr, now + 10 * 60_000)).toBe(false);
    expect(verifyNexconnWebhook("wrong", hdr, now)).toBe(false);
    expect(verifyNexconnWebhook(secret, { ...hdr, signature: null }, now)).toBe(false);
  });
});

describe("AES-GCM secrets", () => {
  it("round-trips and detects tampering", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const sealed = encrypt("ck_live_123");
    expect(decrypt(sealed)).toBe("ck_live_123");
    const bad = Buffer.from(sealed, "base64");
    bad[bad.length - 1] ^= 1;
    expect(() => decrypt(bad.toString("base64"))).toThrow();
  });
});
