import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgRole } from "@/lib/auth/access";
import { listOrders } from "@/lib/db/queries/orders";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Purchases synced from your WooCommerce store. New orders appear here as they arrive.</p>
      </div>
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersTable />
      </Suspense>
    </div>
  );
}

const WC_STATUS: Record<string, string> = {
  completed: "Delivered",
  processing: "Processing",
  "on-hold": "On hold",
  pending: "Pending payment",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const WARRANTY: Record<string, { label: string; tone: string }> = {
  unverified: { label: "Not verified", tone: "text-muted-foreground" },
  pending: { label: "Checking", tone: "text-warning" },
  eligible: { label: "Covered", tone: "text-success" },
  exception: { label: "Covered (exception)", tone: "text-success" },
  expired: { label: "Expired", tone: "text-destructive" },
  not_covered: { label: "Not covered", tone: "text-destructive" },
};

async function OrdersTable() {
  const { actor } = await requireOrgRole(["owner", "support_agent", "dispatcher"]);
  const orders = await listOrders(actor.authUserId);

  if (!orders.length) {
    return (
      <div className="rounded-lg border bg-card p-8">
        <LiveRefresh table="orders" />
        <p className="font-medium">No orders yet</p>
        <p className="mt-1 text-muted-foreground">
          Connect your WooCommerce store and existing orders will import automatically.
        </p>
        <Link href="/dashboard/settings/integrations" className="mt-4 inline-flex h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Connect a store
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <LiveRefresh table="orders" />
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Products</th>
            <th className="px-4 py-3 font-medium">Warranty</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-tag text-base font-semibold">#{o.orderNumber}</p>
                <p className="text-xs">{WC_STATUS[o.wcStatus] ?? o.wcStatus}</p>
                <p className="text-xs text-muted-foreground">{date(o.orderedAt)}</p>
              </td>
              <td className="px-4 py-3">
                <p>{o.customerName}</p>
                <p className="text-xs text-muted-foreground">{o.customerEmail}</p>
              </td>
              <td className="px-4 py-3">
                {o.items.map((i) => (
                  <p key={i.name + i.serialNumber}>
                    {i.name}
                    {i.quantity > 1 && <span className="text-muted-foreground"> × {i.quantity}</span>}
                    {i.serialNumber && <span className="font-tag block text-xs text-muted-foreground">Serial {i.serialNumber}</span>}
                  </p>
                ))}
              </td>
              <td className="px-4 py-3">
                {o.items.map((i) => {
                  const w = WARRANTY[i.warrantyStatus ?? "unverified"];
                  return (
                    <p key={i.name + i.serialNumber}>
                      <span className={cn(w.tone)}>{w.label}</span>
                      {i.warrantyExpiresAt && <span className="block text-xs text-muted-foreground">Until {date(i.warrantyExpiresAt)}</span>}
                    </p>
                  );
                })}
              </td>
              <td className="font-tag px-4 py-3 text-right text-base">{money(o.total, o.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="rounded-lg border bg-card" aria-busy aria-label="Loading orders">
      <div className="h-12 border-b" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.2fr_1.4fr_1fr_0.6fr] gap-4 border-b px-4 py-3 last:border-0">
          <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-3 w-28" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-20" /></div>
          <Skeleton className="ml-auto h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
