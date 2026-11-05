import { RelayStrip } from "@/components/shared/relay-strip";
import { ThemeToggleButton } from "@/components/ui/skiper-ui/skiper26";

/** Sign-in screens: the form on one side, the relay (the product in one picture) on the other. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col px-4 py-8 sm:px-12">
        <header className="flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">RelayCare</span>
          <ThemeToggleButton className="size-11 bg-foreground" variant="circle" start="top-right" />
        </header>
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </section>
      <aside className="hidden flex-col justify-center gap-12 border-l bg-card px-16 lg:flex">
        <p className="max-w-md text-2xl font-semibold tracking-tight text-balance">
          The technician already knows what happened. The customer never explains it twice.
        </p>
        <RelayStrip current="technician" travel className="max-w-lg" />
        <dl className="grid max-w-lg grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="font-tag text-muted-foreground">RC-2026-0042</dt>
          <dd>AquaWash 7kg, water leakage during wash cycle</dd>
          <dt className="font-tag text-muted-foreground">Handoff</dt>
          <dd>Inlet pipe checked by customer, photos received, warranty verified</dd>
        </dl>
      </aside>
    </main>
  );
}
