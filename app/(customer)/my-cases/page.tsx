import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActor } from "@/lib/auth/session";
import { customerStatusIn } from "@/lib/cases/customer-status";
import { tr } from "@/lib/i18n";
import { listMyCases } from "@/lib/db/queries/customer";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Your cases" };

export default function MyCasesPage() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        }
      >
        <Cases />
      </Suspense>
    </div>
  );
}

async function Cases() {
  const actor = await requireActor();
  const cases = await listMyCases(actor.authUserId);
  const t = tr(actor.user.locale);
  const heading = <h1 className="text-xl font-semibold tracking-tight">{t.yourCases}</h1>;
  if (!cases.length) {
    return (
      <div className="space-y-6">
        {heading}
        <EmptyState art="cases" title={t.noCases} body={t.noCasesHint} action={{ href: "/my-orders", label: t.goToPurchases }} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
    {heading}
    <ul className="divide-y panel rounded-xl">
      <LiveRefresh table="service_cases" />
      {cases.map((c) => {
        const s = customerStatusIn(actor.user.locale, c.status);
        const open = !["closed", "cancelled", "rejected", "resolved"].includes(c.status);
        return (
          <li key={c.id}>
            <Link href={`/my-cases/${c.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-accent/50">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${open ? "bg-baton" : "bg-border"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.productName}</span>
                <span className="block text-sm text-muted-foreground">{s.headline}</span>
              </span>
              <span className="text-right">
                <span className="font-tag block text-sm">{c.caseNumber}</span>
                <span className="block text-xs text-muted-foreground">{date(c.updatedAt)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
