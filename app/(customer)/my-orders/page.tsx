import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchaseCard, PurchaseSkeleton } from "@/components/customer/purchase-card";
import { requireActor } from "@/lib/auth/session";
import { listMyPurchases } from "@/lib/db/queries/customer";

export const metadata: Metadata = { title: "Your purchases" };

export default function MyOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Your purchases</h1>
        <p className="text-muted-foreground">Something not working? Choose the product and tell us what happened.</p>
      </div>
      <Suspense fallback={<div className="space-y-4"><PurchaseSkeleton /><PurchaseSkeleton /></div>}>
        <Purchases />
      </Suspense>
    </div>
  );
}

async function Purchases() {
  const actor = await requireActor();
  const purchases = await listMyPurchases(actor.authUserId);
  if (!purchases.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="font-medium">No purchases found for {actor.user.email}</p>
        <p className="mt-1 text-muted-foreground">
          We show orders placed with this email address. If you used a different one, sign out and verify that email instead.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {purchases.map((p) => (
        <PurchaseCard key={p.id} purchase={p} />
      ))}
    </div>
  );
}
