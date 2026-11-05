"use server";

import { eq } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/access";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { storeIntegrations } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/worker";
import { after } from "next/server";

/** Owner-only: reveal the secret the WordPress plugin uses to sign "Get Support" links. */
export async function revealLinkSecret(): Promise<string | null> {
  const { organizationId } = await requireOrgRole(["owner"]);
  const [row] = await db.select().from(storeIntegrations).where(eq(storeIntegrations.organizationId, organizationId));
  return row ? decrypt(row.linkSecretEncrypted) : null;
}

/** Owner-only: re-import orders from the store (idempotent; existing orders are updated, not duplicated). */
export async function resyncOrders(): Promise<{ ok: boolean }> {
  const { organizationId } = await requireOrgRole(["owner"]);
  const [row] = await db.select().from(storeIntegrations).where(eq(storeIntegrations.organizationId, organizationId));
  if (!row) return { ok: false };
  await db.update(storeIntegrations).set({ connectionStatus: "syncing" }).where(eq(storeIntegrations.id, row.id));
  await enqueue("wc.import", { integrationId: row.id, page: 1 }, { dedupeKey: `wc.import:${row.id}:1:${Date.now()}` });
  after(() => runJobs({ budgetMs: 25_000 }).catch((e) => console.error("[jobs] after()", e)));
  return { ok: true };
}
