import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PriorityMark } from "@/components/cases/status-chip";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActor } from "@/lib/auth/session";
import { listMyJobs, type Job } from "@/lib/db/queries/technician";

export const metadata: Metadata = { title: "Your jobs" };

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      }
    >
      <Jobs />
    </Suspense>
  );
}

async function Jobs() {
  const actor = await requireActor();
  const jobs = await listMyJobs(actor.authUserId, actor.user.id);
  const groups: [string, Job[]][] = [
    ["New, waiting for you to accept", jobs.filter((j) => j.assignmentStatus === "assigned")],
    ["Upcoming visits", jobs.filter((j) => j.assignmentStatus === "accepted" && (j.status === "assigned" || j.status === "scheduled"))],
    ["In progress", jobs.filter((j) => j.status === "in_progress")],
    ["Waiting for the customer to confirm", jobs.filter((j) => j.status === "resolution_pending")],
    ["Done", jobs.filter((j) => j.assignmentStatus === "completed" && j.status !== "resolution_pending")],
  ];

  return (
    <div className="space-y-8">
      <LiveRefresh table="service_cases" />
      {jobs.length === 0 && (
        <div className="rounded-lg border bg-card p-6">
          <p className="font-medium">No jobs yet</p>
          <p className="mt-1 text-muted-foreground">When dispatch assigns you a repair, it appears here with the full case history.</p>
        </div>
      )}
      {groups
        .filter(([, list]) => list.length)
        .map(([title, list]) => (
          <section key={title} className="space-y-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <ul className="space-y-2">
              {list.map((j) => (
                <li key={j.caseId}>
                  <Link href={`/technician/jobs/${j.caseId}`} className="block rounded-lg border bg-card p-4 hover:border-primary">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-tag text-sm text-muted-foreground">{j.caseNumber}</span>
                      <PriorityMark priority={j.priority} />
                    </div>
                    <p className="mt-1 font-semibold">{j.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {j.customerName}
                      {j.address?.city ? `, ${j.address.city}` : ""}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm">
                      <span aria-hidden className={`size-2 rounded-full ${j.assignmentStatus === "assigned" ? "bg-baton" : "bg-foreground/40"}`} />
                      {j.scheduledAt ? `Visit ${when(j.scheduledAt)}` : "Visit not booked yet"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
