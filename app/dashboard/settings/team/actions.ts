"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth/access";
import { db } from "@/lib/db/client";
import { organizationMemberships, servicePartners, technicianProfiles, users } from "@/lib/db/schema";
import { esc, sendEmail } from "@/lib/email/send";
import { supabaseAdmin } from "@/lib/supabase/server";

export type InviteState = { ok?: boolean; error?: string; link?: string; emailed?: boolean };

const Invite = z.object({
  name: z.string().trim().min(1, "Enter their name.").max(100),
  email: z.email("Enter a valid email address.").transform((e) => e.trim().toLowerCase()),
  role: z.enum(["owner", "support_agent", "dispatcher", "technician"]),
});

const ROLE_NAME = { owner: "store owner", support_agent: "support agent", dispatcher: "dispatcher", technician: "technician" } as const;

/**
 * Owner invites a team member (spec Journey A step 10). Creates the RelayCare user and
 * membership, then emails a one-time sign-in link via Resend. If email can't be sent,
 * the link is returned so the owner can share it another way.
 */
export async function inviteMember(_: InviteState, form: FormData): Promise<InviteState> {
  const { organizationId, actor } = await requireOrgRole(["owner"]);
  const parsed = Invite.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, role } = parsed.data;

  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  const user = existing ?? (await db.insert(users).values({ name, email }).returning())[0];
  await db
    .insert(organizationMemberships)
    .values({ organizationId, userId: user.id, role })
    .onConflictDoUpdate({ target: [organizationMemberships.organizationId, organizationMemberships.userId], set: { role, isActive: true } });

  if (role === "technician") {
    const [partner] = await db.select({ id: servicePartners.id }).from(servicePartners).where(eq(servicePartners.organizationId, organizationId));
    await db.insert(technicianProfiles).values({ organizationId, userId: user.id, servicePartnerId: partner?.id }).onConflictDoNothing();
  }

  // Existing auth accounts get a magic link; new ones an invite. Either signs them in once.
  const admin = supabaseAdmin();
  const next = "/dashboard/settings/profile";
  let gen = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { name } } });
  if (gen.error) gen = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (gen.error || !gen.data.properties) return { error: `Member added, but no sign-in link could be created: ${gen.error?.message}` };

  const type = gen.data.properties.verification_type;
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${gen.data.properties.hashed_token}&type=${type}&next=${encodeURIComponent(next)}`;
  const emailed = await sendEmail({
    to: email,
    subject: `${actor.user.name} added you to RelayCare`,
    text: `Hi ${name},\n\n${actor.user.name} added you to Demo Electronics on RelayCare as a ${ROLE_NAME[role]}.\nSign in with this link (it works once): ${link}\n\nThen set a password in your profile.`,
    html: `<p>Hi ${esc(name)},</p><p>${esc(actor.user.name)} added you to Demo Electronics on RelayCare as a ${ROLE_NAME[role]}.</p><p><a href="${link}">Sign in to RelayCare</a> (the link works once), then set a password in your profile.</p>`,
  });
  return { ok: true, emailed, link: emailed ? undefined : link };
}

/** Owner changes a member's role or access. The last active owner can't be removed. */
export async function updateMember(userId: string, change: { role?: z.infer<typeof Invite>["role"]; isActive?: boolean }) {
  const { organizationId } = await requireOrgRole(["owner"]);
  if (change.role !== undefined && !Invite.shape.role.safeParse(change.role).success) return { error: "Unknown role." };

  const [target] = await db
    .select()
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId)));
  if (!target) return { error: "Member not found." };
  const losingOwner = target.role === "owner" && target.isActive && (change.isActive === false || (change.role && change.role !== "owner"));
  if (losingOwner) {
    const [others] = await db
      .select({ n: count() })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.role, "owner"), eq(organizationMemberships.isActive, true), ne(organizationMemberships.userId, userId)));
    if (!others.n) return { error: "The store needs at least one active owner." };
  }
  await db
    .update(organizationMemberships)
    .set(change)
    .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId)));
  return { ok: true };
}
