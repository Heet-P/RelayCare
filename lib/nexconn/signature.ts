import { createHash, randomBytes } from "node:crypto";
import { safeEqual } from "@/lib/crypto";

/**
 * Nexconn signs BOTH Server API requests and webhooks as SHA1(AppSecret + Nonce + Timestamp),
 * hex-encoded. (Different from WooCommerce's HMAC-SHA256; spec §9 "Security detail".)
 */
export function nexconnSignature(appSecret: string, nonce: string, timestamp: string): string {
  return createHash("sha1").update(appSecret + nonce + timestamp).digest("hex");
}

/** Headers for an outgoing Server API request. Nonce ≤ 18 chars, timestamp in ms. */
export function signedHeaders(appKey: string, appSecret: string, now = Date.now()) {
  const nonce = randomBytes(9).toString("hex"); // 18 chars
  const timestamp = String(now);
  return {
    "App-Key": appKey,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: nexconnSignature(appSecret, nonce, timestamp),
  };
}

const MAX_SKEW_MS = 5 * 60 * 1000;

/** Verify an inbound Nexconn webhook. Rejects stale timestamps to limit replay. */
export function verifyNexconnWebhook(
  appSecret: string,
  headers: { nonce: string | null; timestamp: string | null; signature: string | null },
  now = Date.now(),
): boolean {
  const { nonce, timestamp, signature } = headers;
  if (!nonce || !timestamp || !signature) return false;
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_MS) return false;
  return safeEqual(nexconnSignature(appSecret, nonce, timestamp), signature.toLowerCase());
}
