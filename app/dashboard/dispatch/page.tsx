import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseTableSkeleton } from "@/components/cases/case-table";
import { PriorityMark, StatusChip } from "@/components/cases/status-chip";
import { AssignDialog, ScheduleDialog } from "@/components/dispatch/assign-dialog";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { requireOrgRole } from "@/lib/auth/access";
import { age } from "@/lib/cases/labels";
import { DISPATCH_VIEWS, listDispatch, listTechnicians, type DispatchView } from "@/lib/db/queries/dispatch";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispatch centre" };

const visit = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);

export default function DispatchPage({ searchParams }: PageProps<"/dashboard/dispatch">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Dispatch centre</h1>
        <p className="text-muted-foreground">Assign technicians, book visits and keep an eye on everything still open.</p>
      </div>
      <Suspense fallback={<CaseTableSkeleton rows={5} />}>
        {searchParams.then((sp) => (
          <Board view={(typeof sp.view === "string" && sp.view in DISPATCH_VIEWS ? sp.view : "queue") as DispatchView} />
        ))}
      </Suspense>
    </div>
  );
}

async function Board({ view }: { view: DispatchView }) {
  const { actor, organizationId, role } = await requireOrgRole(["owner", "dispatcher", "support_agent"]);
  const [rows, technicians] = await Promise.all([listDispatch(actor.authUserId, view), listTechnicians(organizationId)]);
  const canDispatch = role === "owner" || role === "dispatcher";

  return (
    <div className="space-y-4">
      <LiveRefresh table="service_cases" />
      <nav aria-label="Dispatch views" className="flex flex-wrap gap-1">
        {(Object.keys(DISPATCH_VIEWS) as DispatchView[]).map((k) => (
          <Link
            key={k}
            href={`/dashboard/dispatch?view=${k}`}
            aria-current={k === view ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent",
              k === view && "bg-card font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]",
            )}
          >
            {DISPATCH_VIEWS[k].label}
          </Link>
        ))}
      </nav>

      {!canDispatch && <p className="text-sm text-muted-foreground">You can see the board; assigning technicians is for dispatchers and the store owner.</p>}

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {view === "queue" ? "Nothing waiting for a technician. Cases appear here when support hands them over." : "No cases in this view."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Case</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Technician</th>
                <th className="px-4 py-3 font-medium">Appointment</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/cases/${r.id}`} className="font-tag font-semibold underline-offset-4 hover:underline">
                      {r.caseNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">waiting {age(r.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">{r.productName}</td>
                  <td className="px-4 py-3">
                    <p>{r.customerName}</p>
                    {r.city && <p className="text-xs text-muted-foreground">{r.city}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={r.status} />
                      <PriorityMark priority={r.priority} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.technicianName ? (
                      <>
                        <p>{r.technicianName}</p>
                        <p className="text-xs text-muted-foreground">{r.assignmentStatus === "accepted" ? "Accepted" : "Not accepted yet"}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.scheduledAt ? visit(r.scheduledAt) : <span className="text-muted-foreground">Not booked</span>}</td>
                  <td className="px-4 py-3">
                    {canDispatch && (
                      <div className="flex flex-wrap justify-end gap-2">
                        {(r.status === "awaiting_assignment" || r.technicianName) && (
                          <AssignDialog
                            caseId={r.id}
                            caseNumber={r.caseNumber}
                            city={r.city}
                            current={r.technicianId && r.technicianName ? { id: r.technicianId, name: r.technicianName } : null}
                            technicians={technicians}
                            trigger={r.technicianName ? "Change" : "Assign"}
                          />
                        )}
                        {r.technicianName && <ScheduleDialog caseId={r.id} scheduledAt={r.scheduledAt} />}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
