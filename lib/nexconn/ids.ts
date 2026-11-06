import "server-only";
import { randomBytes } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Stable opaque Nexconn user id, e.g. rcu_k3j9x0p2m7qa. Never derived from email/phone. */
export function newNexconnUserId() {
  const bytes = randomBytes(12);
  return "rcu_" + Array.from(bytes, (b) => ALNUM[b % ALNUM.length]).join("");
}

/**
 * Group channel ids allow letters and digits only: ("RC-2026-0042", case uuid) → "rc20260042a1b2c3".
 * The case-id suffix keeps it unique when a number is reused (demo resets), since Nexconn keeps a
 * dismissed group's history and would show it in the new group.
 */
export const groupChannelId = (caseNumber: string, caseId: string) =>
  caseNumber.toLowerCase().replace(/[^a-z0-9]/g, "") + caseId.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();

/** Return the user's Nexconn id, assigning one on first use (race-safe). */
export async function ensureNexconnId(userId: string): Promise<string> {
  const [u] = await db.select({ id: users.nexconnUserId }).from(users).where(eq(users.id, userId));
  if (u?.id) return u.id;
  await db
    .update(users)
    .set({ nexconnUserId: newNexconnUserId() })
    .where(and(eq(users.id, userId), isNull(users.nexconnUserId)));
  const [after] = await db.select({ id: users.nexconnUserId }).from(users).where(eq(users.id, userId));
  return after!.id!;
}
