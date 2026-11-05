import { createServerClient } from "@supabase/ssr";

/**
 * Sign in as a seeded user and return the Cookie header a browser would send.
 * Used by integration tests and smoke scripts to call authenticated routes over HTTP.
 */
export async function sessionCookie(email: string, password = process.env.SEED_PASSWORD ?? "relaycare-demo-2026") {
  const jar = new Map<string, string>();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
