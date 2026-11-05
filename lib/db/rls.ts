import "server-only";
import { sql } from "drizzle-orm";
import { db, type Tx } from "./client";

/**
 * Run queries as the Supabase `authenticated` role with the user's JWT claims, so Postgres
 * RLS policies (drizzle/0001_rules.sql) apply on top of app-layer checks.
 */
export function withRls<T>(authUserId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: authUserId, role: "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
