import "server-only";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { storeIntegrations } from "@/lib/db/schema";
import { wooClient } from "./client";

export async function loadIntegration(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(storeIntegrations).where(eq(storeIntegrations.id, id));
  return row ?? null;
}

/** Decrypted REST client for an integration. Secrets never leave the server. */
export function clientFor(row: typeof storeIntegrations.$inferSelect) {
  return wooClient({
    storeUrl: row.storeUrl,
    consumerKey: decrypt(row.consumerKeyEncrypted),
    consumerSecret: decrypt(row.consumerSecretEncrypted),
  });
}
