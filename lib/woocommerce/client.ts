import { createHmac, randomBytes } from "node:crypto";

/**
 * Minimal WooCommerce REST v3 client.
 *
 * Auth (WooCommerce rules): HTTPS stores use HTTP Basic with the consumer key/secret.
 * Plain-HTTP stores (local dev) must use one-legged OAuth 1.0a. WooCommerce verifies that
 * signature with its OWN normalisation, which we mirror exactly: rawurlencode each key and
 * value, sort by key, rawurlencode each "key=value" AGAIN, join with %26; HMAC key = secret + "&".
 */
export type WooCredentials = { storeUrl: string; consumerKey: string; consumerSecret: string };

export class WooError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** RFC 3986 encoding, same as PHP rawurlencode. */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export function oauthQuery(method: string, url: string, query: Record<string, string>, key: string, secret: string, now = Date.now()) {
  const params: Record<string, string> = {
    ...query,
    oauth_consumer_key: key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: String(Math.floor(now / 1000)),
  };
  const normalized = Object.keys(params)
    .map((k) => [enc(k), enc(params[k])] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => enc(`${k}=${v}`))
    .join("%26");
  const base = `${method.toUpperCase()}&${enc(url)}&${normalized}`;
  const signature = createHmac("sha256", `${secret}&`).update(base).digest("base64");
  return { ...params, oauth_signature: signature };
}

export function wooClient(creds: WooCredentials) {
  const root = creds.storeUrl.replace(/\/+$/, "") + "/wp-json/wc/v3";
  const https = root.startsWith("https://");

  async function request<T>(method: string, path: string, query: Record<string, string> = {}, body?: unknown) {
    const url = root + path;
    const q = https ? query : oauthQuery(method, url, query, creds.consumerKey, creds.consumerSecret);
    const res = await fetch(`${url}?${new URLSearchParams(q)}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(https
          ? { Authorization: "Basic " + Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64") }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new WooError(res.status, json?.code ?? "http_error", json?.message ?? res.statusText);
    return { data: json as T, totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1) };
  }

  return {
    get: <T>(path: string, query?: Record<string, string>) => request<T>("GET", path, query),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, {}, body),
    delete: <T>(path: string, query?: Record<string, string>) => request<T>("DELETE", path, query),
  };
}
