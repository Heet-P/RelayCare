import { cn } from "@/lib/utils";

export type Station = "customer" | "agent" | "dispatcher" | "technician";

const STATIONS: { key: Station; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "agent", label: "Support" },
  { key: "dispatcher", label: "Dispatch" },
  { key: "technician", label: "Technician" },
];

/**
 * The relay: four stations a service case passes through, with the signal-yellow baton on
 * whoever holds the case now. The baton colour is reserved for this meaning across the app.
 *
 * `travel` plays a single pass from customer to technician (sign-in screen only);
 * it is skipped under prefers-reduced-motion.
 */
export function RelayStrip({
  current,
  travel = false,
  labels,
  className,
}: {
  current: Station | null;
  travel?: boolean;
  labels?: Partial<Record<Station, string>>;
  className?: string;
}) {
  const index = current ? STATIONS.findIndex((s) => s.key === current) : -1;
  return (
    <div className={cn("w-full", className)} role="img" aria-label={current ? `Case is with ${labels?.[current] ?? STATIONS[index].label}` : "Case closed"}>
      <ol className="relative grid grid-cols-4">
        {/* the rail */}
        <span aria-hidden className="absolute top-3 right-[12.5%] left-[12.5%] h-0.5 bg-border" />
        {index > 0 && (
          <span
            aria-hidden
            className="absolute top-3 left-[12.5%] h-0.5 bg-foreground/60"
            style={{ width: `${(index / 3) * 75}%` }}
          />
        )}
        {travel && (
          <span
            aria-hidden
            className="relay-baton-travel absolute top-1.5 left-[12.5%] h-3 w-8 -translate-x-1/2 rounded-full bg-baton shadow-[0_0_0_4px_var(--background)] motion-reduce:hidden"
          />
        )}
        {STATIONS.map((s, i) => {
          const holds = i === index && !travel;
          const passed = i < index;
          return (
            <li key={s.key} className="relative flex flex-col items-center gap-2">
              <span
                className={cn(
                  "relative z-10 grid size-6 place-items-center rounded-full border-2 bg-background",
                  passed ? "border-foreground/60 bg-foreground/60" : "border-border",
                  holds && "border-baton bg-baton",
                )}
              >
                {holds && <span className="size-2 rounded-full bg-baton-foreground" />}
              </span>
              <span className={cn("text-xs text-muted-foreground", holds && "font-semibold text-foreground")}>
                {labels?.[s.key] ?? s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {travel && (
        <style>{`
          @keyframes relay-baton { 0% { left: 12.5% } 30% { left: 12.5% } 100% { left: 87.5% } }
          .relay-baton-travel { animation: relay-baton 2.4s cubic-bezier(.6,0,.2,1) .4s both; }
        `}</style>
      )}
    </div>
  );
}
