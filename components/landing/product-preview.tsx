import { RelayStrip } from "@/components/shared/relay-strip";
import { cn } from "@/lib/utils";

/**
 * The product, shown instead of drawn: the case as the team sees it, with the customer's phone
 * in front (her Gujarati message, translated for support). Static markup from the real tokens
 * and components, so it always matches the app.
 */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[600px] pb-16 sm:pb-10", className)} aria-hidden>
      {/* The case, as support sees it */}
      <div className="panel space-y-5 rounded-2xl p-6 sm:mr-24">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-tag text-sm text-muted-foreground">RC-2026-0042</p>
            <p className="text-lg font-semibold tracking-tight">AquaWash 7kg, water leak</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            <span className="size-1.5 rounded-full bg-amber" /> Visit booked
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Warranty</dt>
            <dd className="font-medium">Covered until Oct 2027</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Visit</dt>
            <dd className="font-medium">Sat 8 Nov, 11:00</dd>
          </div>
        </dl>
        <RelayStrip current="technician" labels={{ customer: "Priya", agent: "Maya", dispatcher: "Arjun", technician: "Ravi" }} />
      </div>

      {/* Her phone, in front */}
      <div className="glass-strong absolute right-0 -bottom-2 w-[260px] rounded-[32px] p-2 sm:-bottom-6">
        <div className="space-y-2 rounded-[24px] bg-background p-3 text-sm">
          <p className="px-1 text-xs text-muted-foreground">Support, Demo Electronics</p>
          <div className="ml-6 rounded-[18px] rounded-br-md bg-primary px-3 py-2 text-primary-foreground">
            <span lang="gu">મારું વોશિંગ મશીન નીચેથી પાણી લીક કરે છે.</span>
          </div>
          <p className="ml-6 px-1 text-xs text-muted-foreground">Maya reads: “My washing machine is leaking from the bottom.”</p>
        </div>
      </div>
    </div>
  );
}
