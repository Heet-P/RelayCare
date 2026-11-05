import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseTable, CaseTableSkeleton } from "@/components/cases/case-table";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgRole } from "@/lib/auth/access";
import { age, describeEvent } from "@/lib/cases/labels";
import { BarList } from "@/components/dashboard/bar-list";
import { categoryLabel } from "@/lib/cases/categories";
import { STATUS_LABEL } from "@/lib/cases/labels";
import type { CaseStatus } from "@/lib/cases/state-machine";
import { needsAttention, overviewStats, recentActivity, serviceAnalytics } from "@/lib/db/queries/staff";

export const metadata: Metadata = { title: "Overview" };

const STAFF = ["owner", "support_agent", "dispatcher"] as const;

export default function OverviewPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Needs attention</h1>
            <p className="text-muted-foreground">New reports, cases in review and cases waiting for a technician, most urgent first.</p>
          </div>
          <Link href="/dashboard/cases" className="inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            All cases
          </Link>
        </div>
        <Suspense fallback={<CaseTableSkeleton />}>
          <Queue />
        </Suspense>
      </section>
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <Stats />
      </Suspense>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">How service is going</h2>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <Analytics />
        </Suspense>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <Activity />
        </Suspense>
      </section>
    </div>
  );
}

async function Queue() {
  const { actor } = await requireOrgRole([...STAFF]);
  const rows = await needsAttention(actor.authUserId);
  return (
    <>
      <LiveRefresh table="service_cases" />
      <CaseTable rows={rows} empty="Nothing waiting. New customer reports will appear here as they arrive." />
    </>
  );
}

async function Stats() {
  const { actor } = await requireOrgRole([...STAFF]);
  const s = await overviewStats(actor.authUserId);
  const items = [
    { label: "Open cases", value: s.open },
    { label: "Waiting for a technician", value: s.awaitingAssignment },
    { label: "Waiting on customers", value: s.awaitingCustomer },
    { label: "With technicians", value: s.inProgress },
    { label: "Awaiting confirmation", value: s.pendingResolution },
    { label: "Average time to resolve", value: s.avgResolutionHours == null ? "—" : s.avgResolutionHours < 48 ? `${s.avgResolutionHours} h` : `${Math.round(s.avgResolutionHours / 24)} d` },
  ];
  return (
    <dl className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
      {items.map((i) => (
        <div key={i.label} className="space-y-1 p-4">
          <dt className="text-sm text-muted-foreground">{i.label}</dt>
          <dd className="font-tag text-xl font-semibold">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function Activity() {
  const { actor } = await requireOrgRole([...STAFF]);
  const events = await recentActivity(actor.authUserId);
  if (!events.length) return <p className="text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="divide-y rounded-lg border bg-card">
      {events.map((e) => (
        <li key={e.id} className="flex items-baseline gap-3 px-4 py-3 text-sm">
          <Link href={`/dashboard/cases/${e.caseId}`} className="font-tag shrink-0 font-medium underline-offset-4 hover:underline">
            {e.caseNumber}
          </Link>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{e.actorName ?? "RelayCare"}</span> {describeEvent(e)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{age(e.createdAt)} ago</span>
        </li>
      ))}
    </ol>
  );
}

const STAGES: CaseStatus[] = ["submitted", "under_triage", "warranty_review", "awaiting_assignment", "assigned", "scheduled", "in_progress", "resolution_pending"];

async function Analytics() {
  const { actor } = await requireOrgRole([...STAFF]);
  const a = await serviceAnalytics(actor.authUserId);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title="Cases by issue" unit="cases" empty="No cases yet." rows={a.byCategory.map((r) => ({ label: categoryLabel(r.category), value: r.n }))} />
      <BarList
        title="Average time at each stage"
        unit="hours"
        empty="Stage times appear once cases move along."
        rows={STAGES.flatMap((st) => {
          const r = a.stageHours.find((x) => x.status === st);
          return r ? [{ label: STATUS_LABEL[st], value: r.hours, note: `${r.samples} case${r.samples === 1 ? "" : "s"}` }] : [];
        })}
      />
      <BarList title="Open jobs per technician" unit="open jobs" empty="No technician jobs yet." rows={a.workload.map((w) => ({ label: w.name, value: w.open, note: `${w.done} completed` }))} />
      <section className="space-y-1 rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Customer rating</h3>
        <p className="font-tag text-2xl font-semibold">{a.csat?.avg != null ? `${a.csat.avg} / 5` : "No ratings yet"}</p>
        <p className="text-sm text-muted-foreground">{a.csat?.n ? `From ${a.csat.n} resolved case${a.csat.n === 1 ? "" : "s"}` : "Customers rate the service after confirming a fix."}</p>
      </section>
    </div>
  );
}
