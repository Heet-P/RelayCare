"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const MIN_INTERVAL_MS = 2000;

/**
 * Re-renders the current server page when rows change in `table` (Supabase Realtime, filtered
 * by the same RLS policies as the page). Renders nothing.
 *
 * Guard rails against refresh storms: one subscription per mount (the router is read through a
 * ref, so re-renders never re-subscribe), at most one refresh every 2 s (trailing), nothing while
 * the tab is hidden, and one catch-up refresh when it becomes visible again.
 */
export function LiveRefresh({ table }: { table: "orders" | "service_cases" | "case_events" }) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let missed = false;

    const refresh = () => {
      if (document.hidden) {
        missed = true;
        return;
      }
      const wait = Math.max(0, last + MIN_INTERVAL_MS - Date.now());
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        routerRef.current.refresh();
      }, Math.max(wait, 250));
    };
    const onVisible = () => {
      if (!document.hidden && missed) {
        missed = false;
        refresh();
      }
    };

    const channel = supabase.channel(`live:${table}:${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table }, refresh).subscribe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [table]);

  return null;
}
