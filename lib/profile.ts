"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { supabaseServer } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; error?: string };

const Profile = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  phone: z.string().trim().max(30).optional(),
  locale: z.enum(["en", "hi", "gu"]),
});

/** Anyone signed in: name, phone and chat language (translation target). */
export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const actor = await requireActor();
  const parsed = Profile.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db
    .update(users)
    .set({ name: parsed.data.name, phone: parsed.data.phone || null, locale: parsed.data.locale })
    .where(eq(users.id, actor.user.id));
  return { ok: true };
}

export async function changePassword(_: ProfileState, form: FormData): Promise<ProfileState> {
  await requireActor();
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== form.get("confirm")) return { error: "The passwords don't match." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : { ok: true };
}

/** Language switch for any signed-in user (customer portal and technician headers). */
export async function setLocale(locale: string): Promise<ProfileState> {
  const actor = await requireActor();
  if (!["en", "hi", "gu"].includes(locale)) return { error: "Unsupported language." };
  await db.update(users).set({ locale }).where(eq(users.id, actor.user.id));
  return { ok: true };
}
