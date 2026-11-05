import { NextResponse } from "next/server";
import { notFound } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * DEV ONLY: sign in a seeded demo account by password, e.g. the customer, whose
 * @relaycare.test inbox can't receive email codes. 404 in production.
 *   /api/dev/sign-in?as=customer&next=/my-orders
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const as = url.searchParams.get("as") ?? "customer";
  if (!["owner", "maya", "arjun", "ravi", "customer"].includes(as)) throw notFound();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env[`SEED_${as.toUpperCase()}_EMAIL`] ?? `${as}@relaycare.test`,
    password: process.env.SEED_PASSWORD ?? "relaycare-demo-2026",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const next = url.searchParams.get("next") ?? "/";
  return NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/", url));
}
