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
      className="glass fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-full p-1.5 sm:static sm:flex sm:max-w-none sm:rounded-full sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none"
    >
      {TABS.map(({ href, key, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "pressable flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground sm:h-11",
              active && "bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] font-semibold text-foreground",
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
