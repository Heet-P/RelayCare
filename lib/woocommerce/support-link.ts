import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";

/**
 * "Get Support" links from the WordPress plugin:
 *   sig = HMAC-SHA256(link_secret, "i|o|e|exp")  (see wordpress/relaycare-woocommerce)
 * A valid link only pre-selects the order and pre-fills the email; the customer must still
 * prove the email with a one-time code before seeing anything (spec §8).
 */
export type SupportLink = { i: string; o: string; e: string; exp: string; sig: string };

export const signSupportLink = (secret: string, l: Omit<SupportLink, "sig">) =>
  createHmac("sha256", secret).update([l.i, l.o, l.e, l.exp].join("|")).digest("hex");

export function verifySupportLink(secret: string, l: SupportLink, now = Date.now()): boolean {
  if (!/^\d+$/.test(l.exp) || Number(l.exp) * 1000 < now) return false;
  return safeEqual(signSupportLink(secret, l), l.sig);
}
