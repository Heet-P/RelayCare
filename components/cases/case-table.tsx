import Link from "next/link";
import type { CaseRow } from "@/lib/db/queries/staff";
import { age } from "@/lib/cases/labels";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityMark, StatusChip } from "./status-chip";

/** Staff case list. The yellow dot marks who holds the case right now (the baton). */
export function CaseTable({ rows, empty }: { rows: CaseRow[]; empty: string }) {
  if (!rows.length) return <EmptyState art="done" title="All caught up" body={empty} />;
  return (
    <div className="overflow-x-auto panel rounded-xl">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Case</th>
            <th className="px-4 py-3 font-medium">Product and customer</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">With</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => (
            <tr key={c.id} className="relative hover:bg-accent/40">
              <td className="px-4 py-3">
                <Link href={`/dashboard/cases/${c.id}`} className="font-tag font-semibold after:absolute after:inset-0">
                  {c.caseNumber}
                </Link>
                <p className="text-xs text-muted-foreground">opened {age(c.createdAt)} ago</p>
              </td>
              <td className="px-4 py-3">
                <p>{c.productName}</p>
                <p className="text-xs text-muted-foreground">{c.customerName}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={c.status} />
                  <PriorityMark priority={c.priority} />
                </div>
              </td>
              <td className="px-4 py-3">
                {c.ownerName ? (
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 rounded-full bg-baton" />
                    {c.ownerName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Dispatch queue</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CaseTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel rounded-xl" aria-busy aria-label="Loading cases">
      <div className="h-12 border-b" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.6fr_1fr_1fr] gap-4 border-b px-4 py-3 last:border-0">
          <div className="space-y-2"><span className="block h-5 w-28 animate-pulse rounded bg-muted" /><span className="block h-3 w-20 animate-pulse rounded bg-muted" /></div>
          <div className="space-y-2"><span className="block h-4 w-36 animate-pulse rounded bg-muted" /><span className="block h-3 w-28 animate-pulse rounded bg-muted" /></div>
          <span className="h-6 w-28 animate-pulse rounded bg-muted" />
          <span className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
