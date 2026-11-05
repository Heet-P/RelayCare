import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { oauthQuery } from "@/lib/woocommerce/client";

// Re-implementation of WC_REST_Authentication::check_oauth_signature (PHP) for one request.
function wooServerSignature(method: string, url: string, params: Record<string, string>, secret: string) {
  const raw = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const { oauth_signature: _ignored, ...rest } = params;
  const normalized = Object.entries(rest).map(([k, v]) => [raw(k), raw(v)] as const);
  normalized.sort(([a], [b]) => (a < b ? -1 : 1));
  const query = normalized.map(([k, v]) => raw(`${k}=${v}`)).join("%26");
  return createHmac("sha256", `${secret}&`).update(`${method}&${raw(url)}&${query}`).digest("base64");
}

describe("WooCommerce OAuth 1.0a", () => {
  it("matches WooCommerce's server-side signature, including values with reserved characters", () => {
    const url = "http://localhost:8080/wp-json/wc/v3/orders";
    const q = oauthQuery("GET", url, { per_page: "50", after: "2025-01-01T00:00:00", search: "a b+c" }, "ck_x", "cs_y");
    expect(q.oauth_signature).toBe(wooServerSignature("GET", url, q, "cs_y"));
    expect(q.oauth_signature_method).toBe("HMAC-SHA256");
  });
});
