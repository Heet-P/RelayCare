import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };

// ponytail: placeholder until Phase 4 builds the queue and stats.
export default function OverviewPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
      <p className="text-muted-foreground">Cases waiting for you will appear here.</p>
    </div>
  );
}
