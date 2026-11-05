import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/auth/access";
import { ConnectWooInput, type ConnectWooResult } from "@/lib/contracts/integrations";
import { decrypt, encrypt, randomSecret } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { storeIntegrations } from "@/lib/db/schema";
import { handle, HttpError } from "@/lib/http";
import { enqueue } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/worker";
import { WooError, wooClient } from "@/lib/woocommerce/client";

const TOPICS = ["order.created", "order.updated"] as const;

/** Where WooCommerce should deliver webhooks. In Docker dev the store reaches the host via host.docker.internal. */
const deliveryUrl = (integrationId: string) =>
  `${process.env.WC_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/woocommerce/${integrationId}`;

/**
 * POST /api/integrations/woocommerce/connect — spec Journey A (owner only).
 * Verifies the keys, stores them encrypted, registers order webhooks when the key allows it,
 * and queues the import of existing orders. One store per organisation (MVP): reconnecting
 * replaces the previous credentials and webhooks.
 */
export const POST = handle(async (req: Request) => {
  const { organizationId } = await requireOrgRole(["owner"]);
  const input = ConnectWooInput.parse(await req.json());
  const wc = wooClient(input);

  try {
    await wc.get("/system_status");
  } catch (err) {
    if (err instanceof WooError && (err.status === 401 || err.status === 403)) {
      throw new HttpError(400, "WooCommerce rejected these API keys.", "woo_auth");
    }
    throw new HttpError(400, `Could not reach the store's REST API (${(err as Error).message}).`, "woo_unreachable");
  }

  const webhookSecret = randomSecret();
  const [existing] = await db.select().from(storeIntegrations).where(eq(storeIntegrations.organizationId, organizationId));
  const values = {
    organizationId,
    storeUrl: input.storeUrl,
    consumerKeyEncrypted: encrypt(input.consumerKey),
    consumerSecretEncrypted: encrypt(input.consumerSecret),
    webhookSecretEncrypted: encrypt(webhookSecret),
    // Keep the plugin's link secret stable across reconnects so installed plugins keep working.
    linkSecretEncrypted: existing?.linkSecretEncrypted ?? encrypt(randomSecret()),
    connectionStatus: "syncing",
    webhookIds: {},
  };
  const [integration] = existing
    ? await db.update(storeIntegrations).set(values).where(eq(storeIntegrations.id, existing.id)).returning()
    : await db.insert(storeIntegrations).values(values).returning();

  // Remove webhooks we registered previously (best effort, old keys may be gone).
  if (existing) {
    const old = wooClient({ storeUrl: existing.storeUrl, consumerKey: decrypt(existing.consumerKeyEncrypted), consumerSecret: decrypt(existing.consumerSecretEncrypted) });
    await Promise.allSettled(Object.values(existing.webhookIds).map((id) => old.delete(`/webhooks/${id}`, { force: "true" })));
  }

  const url = deliveryUrl(integration.id);
  let mode: ConnectWooResult["webhooks"] = "auto";
  const ids: Record<string, number> = {};
  for (const topic of TOPICS) {
    try {
      const { data } = await wc.post<{ id: number }>("/webhooks", {
        name: `RelayCare ${topic === "order.created" ? "Order Created" : "Order Updated"}`,
        status: "active",
        topic,
        delivery_url: url,
        secret: webhookSecret,
      });
      ids[topic] = data.id;
    } catch (err) {
      if (err instanceof WooError && (err.status === 401 || err.status === 403)) {
        mode = "manual"; // read-only key: guide the merchant instead
        break;
      }
      throw err;
    }
  }

  await db
    .update(storeIntegrations)
    .set({ webhookIds: ids, keyPermissions: mode === "auto" ? "read_write" : "read" })
    .where(eq(storeIntegrations.id, integration.id));
  await enqueue("wc.import", { integrationId: integration.id, page: 1 }, { dedupeKey: `wc.import:${integration.id}:1:${Date.now()}` });
  after(() => runJobs({ budgetMs: 25_000 }).catch((e) => console.error("[jobs] after()", e)));

  const result: ConnectWooResult = {
    integrationId: integration.id,
    webhooks: mode,
    deliveryUrl: url,
    ...(mode === "manual" ? { webhookSecret } : {}),
  };
  return NextResponse.json(result);
});
