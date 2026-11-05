import "server-only";
import { sql } from "drizzle-orm";
import { db, type Tx } from "./client";

/**
 * Run queries as the Supabase `authenticated` role with the user's JWT claims, so Postgres
 * RLS policies (drizzle/0001_rules.sql) apply on top of app-layer checks.
 * Claims and role are set in ONE statement (set_config('role', …, true) == SET LOCAL ROLE)
 * to save a database round trip per request.
 */
export function withRls<T>(authUserId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: authUserId, role: "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`);
    return fn(tx);
  });
}
