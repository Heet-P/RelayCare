"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/dashboard/settings/profile", label: "Your profile" },
  { href: "/dashboard/settings/team", label: "Team" },
  { href: "/dashboard/settings/warranty", label: "Warranty rules" },
  { href: "/dashboard/settings/integrations", label: "Store integration" },
] as const;

export function SettingsNav() {
  return (
    <Suspense fallback={<Links path="" />}>
      <Active />
    </Suspense>
  );
}

function Active() {
  return <Links path={usePathname()} />;
}

function Links({ path }: { path: string }) {
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-1 border-b">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={path.startsWith(s.href) ? "page" : undefined}
          className={cn(
            "inline-flex h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground",
            path.startsWith(s.href) && "font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
