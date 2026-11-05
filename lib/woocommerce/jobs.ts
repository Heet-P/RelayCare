import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { storeIntegrations, webhookInbox } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";
import { ingestOrder } from "./ingest";
import { clientFor, loadIntegration } from "./integration";
import { normalizeOrder } from "./normalize";

/** Process one stored webhook delivery (spec §8: background processor). */
export async function processInbox({ inboxId }: Record<string, unknown>) {
  const [row] = await db.select().from(webhookInbox).where(eq(webhookInbox.id, String(inboxId)));
  if (!row || row.processedAt) return; // already done: never process the same delivery twice
  const integration = await loadIntegration(row.integrationId);
  if (!integration) throw new Error(`Integration ${row.integrationId} not found`);

  try {
    // order.deleted is out of MVP scope: the purchase record and any cases stay intact.
    if (row.topic === "order.created" || row.topic === "order.updated") {
      await ingestOrder(integration.organizationId, normalizeOrder(row.payload, integration.serialMetaKeys));
    }
    await db.update(webhookInbox).set({ processedAt: new Date(), error: null }).where(eq(webhookInbox.id, row.id));
  } catch (err) {
    await db
      .update(webhookInbox)
      .set({ error: err instanceof Error ? err.message.slice(0, 2000) : String(err) })
      .where(eq(webhookInbox.id, row.id));
    throw err;
  }
}

const IMPORT_MONTHS = 18;
const PAGE_SIZE = 50;

/** Backfill existing orders one page per job, so each job stays short and retryable. */
export async function importOrders({ integrationId, page = 1 }: Record<string, unknown>) {
  const integration = await loadIntegration(String(integrationId));
  if (!integration) return;
  const after = new Date();
  after.setUTCMonth(after.getUTCMonth() - IMPORT_MONTHS);

  const { data, totalPages } = await clientFor(integration).get<unknown[]>("/orders", {
    per_page: String(PAGE_SIZE),
    page: String(page),
    after: after.toISOString().slice(0, 19),
    orderby: "id",
    order: "asc",
  });
  for (const order of data) {
    await ingestOrder(integration.organizationId, normalizeOrder(order, integration.serialMetaKeys));
  }

  const next = Number(page) + 1;
  if (next <= totalPages) {
    await enqueue("wc.import", { integrationId, page: next }, { dedupeKey: `wc.import:${integrationId}:${next}:${Date.now()}` });
  } else {
    await db
      .update(storeIntegrations)
      .set({ lastSyncAt: new Date(), connectionStatus: "connected" })
      .where(eq(storeIntegrations.id, integration.id));
  }
}
