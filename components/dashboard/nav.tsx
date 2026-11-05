"use client";

import { Building2, ClipboardList, Inbox, LayoutGrid, MessagesSquare, Route, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

/** Spec §4 main navigation. */
export const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/cases", label: "Service cases", icon: ClipboardList },
  { href: "/dashboard/dispatch", label: "Dispatch centre", icon: Route },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/dashboard/orders", label: "Orders", icon: Inbox },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  // Active state needs the URL (request-time data), so it streams in behind Suspense.
  return (
    <Suspense fallback={<NavLinks path="" onNavigate={onNavigate} />}>
      <ActiveNav onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks path={usePathname()} onNavigate={onNavigate} />;
}

function NavLinks({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "pressable flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-foreground",
              active && "bg-card text-foreground shadow-[0_1px_2px_rgb(28_25_23/0.08),0_0_0_1px_var(--border)] hover:bg-card",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-primary" : "")} aria-hidden strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export const StoreMark = () => (
  <span className="flex items-center gap-2 pl-[42px] text-xs text-muted-foreground">
    <Building2 className="size-3.5" aria-hidden /> Demo Electronics
  </span>
);
