import { createBrowserClient } from "@supabase/ssr";

/** Browser client: auth flows + Realtime subscriptions (RLS-filtered). */
export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
