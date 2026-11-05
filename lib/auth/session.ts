import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { customers, organizationMemberships, users } from "@/lib/db/schema";
import { supabaseServer } from "@/lib/supabase/server";
import { unauthorized } from "@/lib/http";

export type MemberRole = "owner" | "support_agent" | "dispatcher" | "technician";

export type Actor = {
  authUserId: string;
  user: typeof users.$inferSelect;
  memberships: { organizationId: string; role: MemberRole }[];
  /** Customer records this user has proven ownership of (verified email). */
  customerIds: string[];
};

/**
 * The signed-in user, resolved once per request. Returns null when signed out.
 * Supabase `getUser()` re-validates the JWT with the auth server (never trust the cookie alone).
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser?.email) return null;

  const user = await ensureAppUser(authUser.id, authUser.email, authUser.user_metadata?.name);
  const [memberships, owned] = await Promise.all([
    db
      .select({ organizationId: organizationMemberships.organizationId, role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.userId, user.id), eq(organizationMemberships.isActive, true))),
    db.select({ id: customers.id }).from(customers).where(eq(customers.userId, user.id)),
  ]);
  return { authUserId: authUser.id, user, memberships, customerIds: owned.map((c) => c.id) };
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw unauthorized();
  return actor;
}

/**
 * Map a verified Supabase identity to a RelayCare user, creating or linking on first sign-in.
 * Pre-created rows (seed, staff invites) are claimed by matching email. Any WooCommerce
 * customer records with the same email are linked too: Supabase only issues a session after
 * the email is verified (OTP / magic link / confirmed sign-up), which is the ownership proof.
 */
async function ensureAppUser(authUserId: string, email: string, name?: string) {
  const [existing] = await db.select().from(users).where(eq(users.authUserId, authUserId));
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [byEmail] = await tx
      .select()
      .from(users)
      .where(and(sql`lower(${users.email}) = lower(${email})`, isNull(users.authUserId)));
    const [user] = byEmail
      ? await tx.update(users).set({ authUserId }).where(eq(users.id, byEmail.id)).returning()
      : await tx
          .insert(users)
          .values({ authUserId, email, name: name || email.split("@")[0] })
          .returning();

    await tx
      .update(customers)
      .set({ userId: user.id, verifiedAt: new Date() })
      .where(and(sql`lower(${customers.email}) = lower(${email})`, isNull(customers.userId)));
    return user;
  });
}

export function roleIn(actor: Actor, organizationId: string): MemberRole | null {
  return actor.memberships.find((m) => m.organizationId === organizationId)?.role ?? null;
}

/** The org a staff member is working in (MVP: one store, so the first membership). */
export function primaryOrg(actor: Actor) {
  return actor.memberships[0] ?? null;
}
