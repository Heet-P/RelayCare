import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
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
 * The JWT is signature-verified (getClaims), never trusted from the cookie alone.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  // Session data is per-request: opt out of prerendering before the auth client reads the clock.
  await connection();
  const supabase = await supabaseServer();
  // getClaims() verifies the JWT signature locally against the project's public (ES256) keys,
  // instead of a round trip to the auth server on every request like getUser().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !claims.email) return null;
  const authUser = { id: claims.sub, email: claims.email, name: (claims.user_metadata as { name?: string } | undefined)?.name };

  // One round trip for the user, their active memberships and linked customer records
  // (this runs on every request; the database may be far away in development).
  const loaded = await loadActorRows(authUser.id);
  if (loaded) return { authUserId: authUser.id, ...loaded };
  await ensureAppUser(authUser.id, authUser.email, authUser.name); // first sign-in only
  const created = await loadActorRows(authUser.id);
  return created ? { authUserId: authUser.id, ...created } : null;
});

/**
 * Note: the subqueries reference the outer row as a literal `users.id`. Drizzle renders
 * ${users.id} as a bare "id" in single-table selects, which a subquery would resolve to its
 * own table (customers.id), silently returning nothing.
 */
async function loadActorRows(authUserId: string) {
  const [row] = await db
    .select({
      user: users,
      memberships: sql<Actor["memberships"]>`coalesce((
        select json_agg(json_build_object('organizationId', m.organization_id, 'role', m.role))
        from ${organizationMemberships} m where m.user_id = users.id and m.is_active), '[]'::json)`,
      customerIds: sql<string[]>`coalesce((
        select json_agg(c.id) from ${customers} c where c.user_id = users.id), '[]'::json)`,
    })
    .from(users)
    .where(eq(users.authUserId, authUserId));
  return row ?? null;
}

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
