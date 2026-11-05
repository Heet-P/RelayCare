import { after, NextResponse } from "next/server";
import { decrypt, sha256Hex } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { webhookInbox } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/worker";
import { loadIntegration } from "@/lib/woocommerce/integration";
import { verifyWooSignature } from "@/lib/woocommerce/signature";

/**
 * POST /api/webhooks/woocommerce/:integrationId — spec §8 receiver.
 * Verify → dedupe → store → enqueue → 2xx fast. Processing happens after the response
 * (and again from the cron sweep), never inside this request, so WooCommerce does not
 * disable the webhook after slow or failed deliveries.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/webhooks/woocommerce/[integrationId]">) {
  const { integrationId } = await ctx.params;
  // The signature covers the ORIGINAL bytes: read the raw body, never re-serialise JSON.
  const raw = await req.text();

  const integration = await loadIntegration(integrationId);
  if (!integration) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });

  // WooCommerce pings a new webhook with a form body and no topic header; acknowledge it.
  const topic = req.headers.get("x-wc-webhook-topic");
  if (!topic) return NextResponse.json({ ok: true, ping: true });

  if (!verifyWooSignature(decrypt(integration.webhookSecretEncrypted), raw, req.headers.get("x-wc-webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  // The configured store must be the sender.
  const source = req.headers.get("x-wc-webhook-source");
  if (!source || new URL(source).host !== new URL(integration.storeUrl).host) {
    return NextResponse.json({ error: "Unexpected webhook source" }, { status: 401 });
  }
  const deliveryId = req.headers.get("x-wc-webhook-delivery-id");
  if (!deliveryId) return NextResponse.json({ error: "Missing delivery id" }, { status: 400 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(webhookInbox)
      .values({ integrationId, deliveryId, topic, payload, payloadHash: sha256Hex(raw) })
      .onConflictDoNothing({ target: [webhookInbox.integrationId, webhookInbox.deliveryId] })
      .returning({ id: webhookInbox.id });
    if (row) await enqueue("wc.order.process", { inboxId: row.id }, { tx, dedupeKey: `wc.inbox:${row.id}` });
    return row;
  });

  if (inserted) after(() => runJobs({ budgetMs: 10_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json({ ok: true, duplicate: !inserted });
}
