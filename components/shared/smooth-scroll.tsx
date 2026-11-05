"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Lenis smooth scrolling for the whole page. Off for people who prefer reduced motion.
 * Scrollable regions inside the page (chat history, dialogs) opt out with `data-lenis-prevent`.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  if (reduced) return <>{children}</>;
  return (
    <ReactLenis root options={{ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true, syncTouch: false }}>
      {children}
    </ReactLenis>
  );
}
