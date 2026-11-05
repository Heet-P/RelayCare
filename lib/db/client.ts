import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Owner connection (bypasses RLS). Use ONLY after app-layer authorization (lib/auth/access.ts),
 * or in trusted contexts: webhooks, jobs, seeds. For user-scoped reads prefer `withRls`.
 *
 * `prepare: false` is required by the Supabase transaction pooler.
 */
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const sql = (globalForDb.sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 }));

export const db = drizzle(sql, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
