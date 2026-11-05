import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PurchaseCard, PurchaseSkeleton } from "@/components/customer/purchase-card";
import { requireActor } from "@/lib/auth/session";
import { listMyPurchases } from "@/lib/db/queries/customer";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Order" };

export default function OrderPage({ params }: PageProps<"/my-orders/[orderId]">) {
  return (
    <div className="space-y-6">
      <Link href="/my-orders" className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        All purchases
      </Link>
      <Suspense fallback={<PurchaseSkeleton />}>{params.then(({ orderId }) => <Order orderId={orderId} />)}</Suspense>
    </div>
  );
}

async function Order({ orderId }: { orderId: string }) {
  const actor = await requireActor();
  // RLS-scoped: another customer's order id simply isn't in this list.
  const purchase = (await listMyPurchases(actor.authUserId)).find((p) => p.id === orderId);
  if (!purchase) notFound();
  return (
    <div className="space-y-4">
      <h1 className="font-tag text-xl font-semibold">Order #{purchase.orderNumber}</h1>
      <p className="text-muted-foreground">Total paid {money(purchase.total, purchase.currency)}</p>
      <PurchaseCard purchase={purchase} />
    </div>
  );
}
