"use client";

import { ClipboardList, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/my-orders", label: "Purchases", icon: ShoppingBag },
  { href: "/my-cases", label: "My cases", icon: ClipboardList },
] as const;

/** Bottom tab bar on phones, inline links on wider screens. */
export function CustomerTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-card pb-[env(safe-area-inset-bottom)] sm:static sm:flex sm:gap-1 sm:border-0 sm:bg-transparent sm:pb-0"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground sm:h-11 sm:flex-row sm:gap-2 sm:rounded-md sm:px-3 sm:text-sm sm:hover:bg-accent",
              active && "font-semibold text-foreground sm:bg-card",
            )}
          >
            <Icon className="size-5 sm:size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
