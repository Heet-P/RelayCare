"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; sent?: boolean; email?: string };

const Email = z.email("Enter a valid email address.").transform((e) => e.trim().toLowerCase());
/** Only same-site relative paths may be used as post-login destinations (no open redirects). */
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

/** Staff: email + password. */
export async function signInWithPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: String(form.get("password") ?? "") });
  if (error) return { error: "That email and password don't match a RelayCare account.", email: email.data };
  redirect(safeNext(form.get("next")));
}

/** Customers: step 1, email a 6-digit code (spec Journey B: verify via email OTP). */
export async function sendCode(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: true } });
  if (error) {
    return { error: error.status === 429 ? "Too many codes requested. Wait a minute and try again." : "We couldn't send a code to that address.", email: email.data };
  }
  return { sent: true, email: email.data };
}

/** Customers: step 2, verify the code. Supabase only issues a session for a verified email. */
export async function verifyCode(_: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(form.get("email"));
  const token = String(form.get("token") ?? "").replace(/\D/g, "");
  if (!email.success || token.length !== 6) return { error: "Enter the 6-digit code from the email.", sent: true, email: String(form.get("email") ?? "") };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token, type: "email" });
  if (error) return { error: "That code is wrong or has expired. Request a new one.", sent: true, email: email.data };
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
