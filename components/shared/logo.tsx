import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The RelayCare mark: two overlapping speech bubbles on a graphite tile. One conversation,
 * handed from person to person without starting over; the amber bubble is whoever has it now.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="#1c1917" stroke="rgb(255 255 255 / 0.12)" />
      <path d="M22 14h12a10 10 0 0 1 10 10v2a10 10 0 0 1-10 10h-9l-6 5v-5.6A10 10 0 0 1 12 26v-2a10 10 0 0 1 10-10z" fill="#f5f3ef" />
      <path
        d="M31 25h12a10 10 0 0 1 10 10v2a10 10 0 0 1-3 7.1V50l-6.5-3H31a10 10 0 0 1-10-10v-2a10 10 0 0 1 10-10z"
        fill="#e8a317"
        stroke="#1c1917"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className, sub }: { href?: string; className?: string; sub?: string }) {
  return (
    <Link href={href} className={cn("pressable inline-flex items-center gap-2.5 rounded-md", className)}>
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-[17px] font-semibold tracking-tight">RelayCare</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
    </Link>
  );
}
