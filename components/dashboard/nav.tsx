"use client";

import { Building2, ClipboardList, Inbox, LayoutGrid, MessagesSquare, Route, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const path = usePathname();
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
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              active && "bg-card font-medium text-foreground shadow-[inset_3px_0_0_var(--primary)]",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export const StoreMark = () => (
  <span className="flex items-center gap-2 text-sm text-muted-foreground">
    <Building2 className="size-4" aria-hidden /> Demo Electronics
  </span>
);
