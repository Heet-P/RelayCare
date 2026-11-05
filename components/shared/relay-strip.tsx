import { cn } from "@/lib/utils";

export type Station = "customer" | "agent" | "dispatcher" | "technician";

const STATIONS: { key: Station; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "agent", label: "Support" },
  { key: "dispatcher", label: "Dispatch" },
  { key: "technician", label: "Technician" },
];

/**
 * Who has the case: the four people it passes through, as a stepper. Done steps are filled
 * ink, the current holder is ringed in amber and marked "Now", the rest wait in outline.
 */
export function RelayStrip({
  current,
  labels,
  className,
}: {
  current: Station | null;
  labels?: Partial<Record<Station, string>>;
  className?: string;
}) {
  const index = current ? STATIONS.findIndex((s) => s.key === current) : STATIONS.length;
  const name = (s: (typeof STATIONS)[number]) => labels?.[s.key] ?? s.label;
  return (
    <ol
      className={cn("grid w-full grid-cols-4", className)}
      aria-label={current ? `Case is with ${name(STATIONS[index])}` : "Case closed"}
    >
      {STATIONS.map((s, i) => {
        const now = i === index;
        const done = i < index;
        return (
          <li key={s.key} className="relative flex flex-col items-center gap-2 text-center" aria-current={now ? "step" : undefined}>
            {/* connector to the previous step */}
            {i > 0 && (
              <span aria-hidden className={cn("absolute top-4 right-1/2 -z-0 h-px w-full", i <= index ? "bg-foreground/40" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative grid size-8 place-items-center rounded-full text-xs font-semibold",
                done && "bg-foreground text-background",
                now && "bg-card text-foreground ring-2 ring-amber ring-offset-2 ring-offset-card",
                !done && !now && "border border-border bg-card text-muted-foreground",
              )}
            >
              {name(s).charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 px-1 leading-tight">
              <span className={cn("block truncate text-xs", now ? "font-semibold text-foreground" : "text-muted-foreground")}>{name(s)}</span>
              {(now || name(s) !== s.label) && (
                <span className={cn("block text-xs text-muted-foreground", now && "font-medium text-amber-ink")}>{now ? "Now" : s.label}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
