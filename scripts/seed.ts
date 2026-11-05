/**
 * Seed the demo organisation (spec §13). Idempotent: safe to run repeatedly.
 *
 * Creates Supabase auth users (email confirmed, password set) and the matching RelayCare
 * users/memberships, a service partner, Ravi's technician profile and warranty policies.
 * Orders and customers are NOT seeded: they arrive through the real WooCommerce sync.
 *
 *   pnpm db:seed
 *
 * Override demo emails with SEED_<KEY>_EMAIL (e.g. SEED_CUSTOMER_EMAIL=you@gmail.com) to
 * receive real OTP emails. SEED_PASSWORD sets the shared demo password.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../lib/db/schema";

config({ path: ".env.local" });

const PASSWORD = process.env.SEED_PASSWORD ?? "relaycare-demo-2026";
const people = [
  { key: "OWNER", name: "Heet (Owner)", role: "owner", locale: "en" },
  { key: "MAYA", name: "Maya", role: "support_agent", locale: "en" },
  { key: "ARJUN", name: "Arjun", role: "dispatcher", locale: "en" },
  { key: "RAVI", name: "Ravi", role: "technician", locale: "hi" },
  { key: "CUSTOMER", name: "Demo Customer", role: null, locale: "gu" },
] as const;
const emailFor = (key: string) => process.env[`SEED_${key}_EMAIL`] ?? `${key.toLowerCase()}@relaycare.test`;

const client = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema: s });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function authUserId(email: string, name: string) {
  const created = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (created.data.user) return created.data.user.id;
  // Already exists: find it.
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) throw new Error(`Could not create or find auth user ${email}: ${created.error?.message}`);
  }
}

async function main() {
  const [org] = await db
    .insert(s.organizations)
    .values({ name: "Demo Electronics", slug: "demo-electronics" })
    .onConflictDoUpdate({ target: s.organizations.slug, set: { name: "Demo Electronics" } })
    .returning();

  const ids: Record<string, string> = {};
  for (const p of people) {
    const email = emailFor(p.key);
    const auth = await authUserId(email, p.name);
    const [existing] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = lower(${email})`);
    const [user] = existing
      ? await db.update(s.users).set({ authUserId: auth, name: p.name, locale: p.locale }).where(eq(s.users.id, existing.id)).returning()
      : await db.insert(s.users).values({ authUserId: auth, email, name: p.name, locale: p.locale }).returning();
    ids[p.key] = user.id;

    if (p.role) {
      await db
        .insert(s.organizationMemberships)
        .values({ organizationId: org.id, userId: user.id, role: p.role })
        .onConflictDoUpdate({
          target: [s.organizationMemberships.organizationId, s.organizationMemberships.userId],
          set: { role: p.role, isActive: true },
        });
    }
    console.log(`  ${p.key.padEnd(8)} ${email}`);
  }

  let [partner] = await db
    .select()
    .from(s.servicePartners)
    .where(and(eq(s.servicePartners.organizationId, org.id), eq(s.servicePartners.name, "Demo Electronics Service Team")));
  partner ??= (
    await db
      .insert(s.servicePartners)
      .values({ organizationId: org.id, name: "Demo Electronics Service Team", kind: "in_house", phone: "+91 79 4000 0000" })
      .returning()
  )[0];

  await db
    .insert(s.technicianProfiles)
    .values({ organizationId: org.id, userId: ids.RAVI, servicePartnerId: partner.id, serviceAreas: ["Ahmedabad", "Gandhinagar"] })
    .onConflictDoUpdate({
      target: [s.technicianProfiles.organizationId, s.technicianProfiles.userId],
      set: { servicePartnerId: partner.id, isAvailable: true },
    });

  const policies = await db.select().from(s.warrantyPolicies).where(eq(s.warrantyPolicies.organizationId, org.id));
  if (!policies.length) {
    // Demo records, not a real manufacturer's warranty policy (spec §13).
    await db.insert(s.warrantyPolicies).values([
      {
        organizationId: org.id,
        name: "AquaWash washing machines — 12 months",
        matchType: "sku_prefix",
        matchValue: "AW7",
        durationMonths: 12,
        startBasis: "completed",
        coverageNotes: "Manufacturing defects, leaks and motor faults. Excludes physical damage and misuse.",
        priority: 10,
      },
      { organizationId: org.id, name: "Store default — 12 months", matchType: "all", durationMonths: 12, startBasis: "completed", priority: 0 },
    ]);
  }

  console.log(`Seeded org ${org.slug} (${org.id}). Demo password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
