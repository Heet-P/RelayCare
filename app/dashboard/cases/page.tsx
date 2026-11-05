import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseTable, CaseTableSkeleton } from "@/components/cases/case-table";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { requireOrgRole } from "@/lib/auth/access";
import { listCases, STATUS_GROUPS, type StatusGroup } from "@/lib/db/queries/staff";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Service cases" };

const TABS: { key: StatusGroup | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "triage", label: "In review" },
  { key: "dispatch", label: "Needs technician" },
  { key: "field", label: "With technicians" },
  { key: "customer", label: "Waiting on customer" },
  { key: "done", label: "Finished" },
  { key: "all", label: "All" },
];

export default function CasesPage({ searchParams }: PageProps<"/dashboard/cases">) {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Service cases</h1>
      <Suspense fallback={<CaseTableSkeleton rows={6} />}>
        {searchParams.then((sp) => {
          const group = (typeof sp.group === "string" && (sp.group === "all" || sp.group in STATUS_GROUPS) ? sp.group : "open") as StatusGroup | "all";
          const q = typeof sp.q === "string" ? sp.q : "";
          return <Cases group={group} q={q} />;
        })}
      </Suspense>
    </div>
  );
}

async function Cases({ group, q }: { group: StatusGroup | "all"; q: string }) {
  const { actor } = await requireOrgRole(["owner", "support_agent", "dispatcher"]);
  const rows = await listCases(actor.authUserId, { group, q });
  const href = (g: string) => `/dashboard/cases?group=${g}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <div className="space-y-4">
      <LiveRefresh table="service_cases" />
      <div className="flex flex-wrap items-center gap-4">
        <nav aria-label="Filter cases" className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              aria-current={t.key === group ? "page" : undefined}
              className={cn("inline-flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent", t.key === group && "bg-card font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/dashboard/cases" className="relative ml-auto w-full sm:w-72">
          <input type="hidden" name="group" value={group} />
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Case, customer, product or serial"
            aria-label="Search cases"
            className="h-11 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </form>
      </div>
      <CaseTable rows={rows} empty={q ? `No cases match “${q}”.` : "No cases in this view."} />
    </div>
  );
}
