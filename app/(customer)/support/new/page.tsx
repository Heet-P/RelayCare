import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActor } from "@/lib/auth/session";
import { listMyPurchases } from "@/lib/db/queries/customer";
import { ReportWizard, type WizardItem } from "./report-wizard";

export const metadata: Metadata = { title: "Report a problem" };

export default function NewCasePage({ searchParams }: PageProps<"/support/new">) {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      {searchParams.then((sp) => (
        <Wizard item={typeof sp.item === "string" ? sp.item : undefined} order={typeof sp.order === "string" ? sp.order : undefined} />
      ))}
    </Suspense>
  );
}

async function Wizard({ item, order }: { item?: string; order?: string }) {
  const actor = await requireActor();
  const purchases = await listMyPurchases(actor.authUserId);
  // "Get Support" on an order whose product already has an open case: go straight to that case.
  const fromStore = purchases.find((p) => p.id === order);
  if (fromStore && fromStore.items.every((i) => i.openCase)) {
    const open = fromStore.items[0]?.openCase;
    if (open) redirect(`/my-cases/${open.id}`);
  }
  // Only products without an open case can be reported (one open case per product).
  const items: WizardItem[] = purchases.flatMap((p) =>
    p.items
      .filter((i) => !i.openCase)
      .map((i) => ({ id: i.id, orderId: p.id, orderNumber: p.orderNumber, name: i.name, serialNumber: i.serialNumber })),
  );
  if (!items.length) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-6">
        <p className="font-medium">Nothing to report right now</p>
        <p className="text-muted-foreground">Every product already has an open case, or no purchases match your email.</p>
        <Link href="/my-cases" className="inline-flex h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          See your cases
        </Link>
      </div>
    );
  }
  // From the store's Get Support button we know the order; pick its only product automatically.
  const fromOrder = order ? items.filter((i) => i.orderId === order) : [];
  const preselected = items.find((i) => i.id === item)?.id ?? (fromOrder.length === 1 ? fromOrder[0].id : undefined);
  return <ReportWizard items={fromOrder.length > 1 ? fromOrder : items} preselected={preselected} />;
}

function WizardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
