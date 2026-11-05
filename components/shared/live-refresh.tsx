"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Re-renders the current server page when rows change in `table` (Supabase Realtime,
 * filtered by the same RLS policies as the page itself). Renders nothing.
 */
export function LiveRefresh({ table }: { table: "orders" | "service_cases" | "case_events" }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`live:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // Coalesce bursts (an order webhook touches several rows) into one refresh.
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 300);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, table]);
  return null;
}
