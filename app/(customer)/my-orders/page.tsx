import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchaseCard, PurchaseSkeleton } from "@/components/customer/purchase-card";
import { requireActor } from "@/lib/auth/session";
import { listMyPurchases } from "@/lib/db/queries/customer";
import { tr } from "@/lib/i18n";

export const metadata: Metadata = { title: "Your purchases" };

export default function MyOrdersPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="space-y-4"><PurchaseSkeleton /><PurchaseSkeleton /></div>}>
        <Purchases />
      </Suspense>
    </div>
  );
}

async function Purchases() {
  const actor = await requireActor();
  const purchases = await listMyPurchases(actor.authUserId);
  const t = tr(actor.user.locale);
  const heading = (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{t.yourPurchases}</h1>
      <p className="text-muted-foreground">{t.purchasesIntro}</p>
    </div>
  );
  if (!purchases.length) {
    return (
      <div className="space-y-6">
        {heading}
      <div className="panel rounded-xl p-6">
        <p className="font-medium">No purchases found for {actor.user.email}</p>
        <p className="mt-1 text-muted-foreground">
          We show orders placed with this email address. If you used a different one, sign out and verify that email instead.
        </p>
      </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {heading}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {purchases.map((p) => (
          <PurchaseCard key={p.id} purchase={p} getHelp={t.getHelp} />
        ))}
      </div>
    </div>
  );
}
