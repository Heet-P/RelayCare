import { describeEvent } from "@/lib/cases/labels";
import type { CaseView } from "@/lib/db/queries/case-view";
import { cn } from "@/lib/utils";
import { StatusChip } from "./status-chip";

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);

/** Append-only case history: every status change, decision, handoff and upload, oldest first. */
export function Timeline({ view }: { view: CaseView }) {
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-border">
      {view.events.map((e, i) => {
        const last = i === view.events.length - 1;
        return (
          <li key={e.id} className="relative">
            <span
              aria-hidden
              className={cn("absolute top-1.5 -left-6 size-4 rounded-full border-2 border-background", last ? "bg-amber" : e.newStatus ? "bg-foreground/50" : "bg-border")}
            />
            <p className="text-sm">
              <span className="font-medium">{e.actorId ? (view.people[e.actorId]?.name ?? "Someone") : "RelayCare"}</span> {describeEvent(e)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {e.newStatus && <StatusChip status={e.newStatus} />}
              <time className="text-xs text-muted-foreground" dateTime={e.createdAt.toISOString()}>
                {when(e.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
