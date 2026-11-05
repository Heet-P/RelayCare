import { STATUS_LABEL, STATUS_TONE } from "@/lib/cases/labels";
import type { CaseStatus } from "@/lib/cases/state-machine";
import { cn } from "@/lib/utils";

const TONE = {
  attention: "bg-primary/12 text-primary",
  active: "bg-secondary text-foreground",
  waiting: "bg-muted text-muted-foreground",
  done: "bg-success/10 text-success",
  alert: "bg-destructive/10 text-destructive",
} as const;

export function StatusChip({ status, className }: { status: CaseStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap", TONE[STATUS_TONE[status]], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityMark({ priority }: { priority: string }) {
  if (priority !== "high" && priority !== "urgent") return null;
  return (
    <span className={cn("text-xs font-semibold", priority === "urgent" ? "text-destructive" : "text-warning")}>
      {priority === "urgent" ? "Urgent" : "High"}
    </span>
  );
}
