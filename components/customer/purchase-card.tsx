import Link from "next/link";
import type { Purchase } from "@/lib/db/queries/customer";
import { date } from "@/lib/format";

const DELIVERY: Record<string, string> = {
  completed: "Delivered",
  processing: "On its way",
  "on-hold": "On hold",
  pending: "Awaiting payment",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Customer words for warranty state. Expiry is the store's policy estimate until staff verify it. */
function warrantyLine(status: string | null, expires: string | null) {
  if (status === "expired") return "Warranty expired";
  if (status === "not_covered") return "Not covered by warranty";
  if (status === "eligible" || status === "exception") return `Under warranty${expires ? ` until ${date(expires)}` : ""}`;
  return expires ? `Warranty until ${date(expires)} (to be confirmed)` : "Warranty to be confirmed";
}

export function PurchaseCard({ purchase, getHelp = "Get help with this" }: { purchase: Purchase; getHelp?: string }) {
  return (
    <section className="panel rounded-xl">
      <header className="flex items-baseline justify-between gap-4 border-b px-4 py-3">
        <Link href={`/my-orders/${purchase.id}`} className="font-tag text-base font-semibold underline-offset-4 hover:underline">
          Order #{purchase.orderNumber}
        </Link>
        <span className="text-sm text-muted-foreground">
          {DELIVERY[purchase.wcStatus] ?? purchase.wcStatus}, {date(purchase.completedAt ?? purchase.orderedAt)}
        </span>
      </header>
      <ul className="divide-y">
        {purchase.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="font-medium">
                {item.name}
                {item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
              </p>
              <p className="text-sm text-muted-foreground">{warrantyLine(item.warrantyStatus, item.warrantyExpiresAt)}</p>
            </div>
            {item.openCase ? (
              <Link
                href={`/my-cases/${item.openCase.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                <span aria-hidden className="size-2 rounded-full bg-baton" />
                <span className="font-tag">{item.openCase.caseNumber}</span>
              </Link>
            ) : (
              <Link
                href={`/support/new?item=${item.id}`}
                className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {getHelp}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PurchaseSkeleton() {
  return (
    <div className="panel rounded-xl" aria-hidden>
      <div className="flex justify-between border-b px-4 py-3">
        <span className="h-6 w-32 animate-pulse rounded bg-muted" />
        <span className="h-5 w-36 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center justify-between px-4 py-4">
        <div className="space-y-2">
          <span className="block h-5 w-40 animate-pulse rounded bg-muted" />
          <span className="block h-4 w-56 animate-pulse rounded bg-muted" />
        </div>
        <span className="h-11 w-36 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
