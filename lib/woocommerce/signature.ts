import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";

/**
 * WooCommerce signs webhooks as base64(HMAC-SHA256(secret, rawBody)) in X-WC-Webhook-Signature.
 * Must be computed over the ORIGINAL bytes; re-serialised JSON will not match.
 */
export function wooSignature(secret: string, rawBody: string | Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

export function verifyWooSignature(secret: string, rawBody: string | Buffer, header: string | null): boolean {
  return !!header && safeEqual(wooSignature(secret, rawBody), header);
}
