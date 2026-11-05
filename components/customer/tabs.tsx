"use client";

import { ClipboardList, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/my-orders", key: "purchases", icon: ShoppingBag },
  { href: "/my-cases", key: "myCases", icon: ClipboardList },
] as const;

type Labels = { purchases: string; myCases: string };
const EN: Labels = { purchases: "Purchases", myCases: "My cases" };

/** Bottom tab bar on phones, inline links on wider screens. */
export function CustomerTabs({ labels = EN }: { labels?: Labels }) {
  // The active tab depends on the URL, which is request-time data: stream it in.
  return (
    <Suspense fallback={<Tabs path="" labels={labels} />}>
      <ActiveTabs labels={labels} />
    </Suspense>
  );
}

function ActiveTabs({ labels }: { labels: Labels }) {
  return <Tabs path={usePathname()} labels={labels} />;
}

function Tabs({ path, labels }: { path: string; labels: Labels }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-card pb-[env(safe-area-inset-bottom)] sm:static sm:flex sm:gap-1 sm:border-0 sm:bg-transparent sm:pb-0"
    >
      {TABS.map(({ href, key, icon: Icon }) => {
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
            {labels[key]}
          </Link>
        );
      })}
    </nav>
  );
}
