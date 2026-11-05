import Link from "next/link";
import { cn } from "@/lib/utils";

/** The RelayCare mark: a relay line with the marigold baton, on a peacock squircle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <path d="M14 34h36" stroke="var(--primary-foreground)" strokeWidth="4" strokeLinecap="round" opacity=".5" />
      <circle cx="18" cy="34" r="5" fill="var(--primary-foreground)" />
      <rect x="34" y="28" width="20" height="12" rx="6" fill="var(--baton)" />
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
