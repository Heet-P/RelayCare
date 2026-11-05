import { and, count, eq, isNotNull, isNull, max } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor, primaryOrg } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { storeIntegrations, webhookInbox } from "@/lib/db/schema";
import { date } from "@/lib/format";
import { ConnectStoreForm, PluginSecret, ResyncButton } from "./client";

export const metadata: Metadata = { title: "Store integration" };

export default function IntegrationsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Store integration</h1>
        <p className="text-muted-foreground">
          Connect your WooCommerce store so orders sync and customers can ask for help from their account.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <Integration />
      </Suspense>
    </div>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  connected: { label: "Connected", tone: "bg-success" },
  syncing: { label: "Importing orders", tone: "bg-warning" },
  pending: { label: "Not finished", tone: "bg-warning" },
};

async function Integration() {
  const actor = await getActor();
  const org = actor && primaryOrg(actor);
  if (!org || org.role !== "owner") {
    return (
      <p className="rounded-lg border bg-card p-6 text-muted-foreground">Only the store owner can manage the store connection.</p>
    );
  }

  const [row] = await db.select().from(storeIntegrations).where(eq(storeIntegrations.organizationId, org.organizationId));
  if (!row) {
    return (
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Connect WooCommerce</h2>
        <ConnectSteps />
        <ConnectStoreForm />
      </section>
    );
  }

  const [deliveries] = await db
    .select({ total: count(), last: max(webhookInbox.receivedAt) })
    .from(webhookInbox)
    .where(eq(webhookInbox.integrationId, row.id));
  const [failing] = await db
    .select({ n: count() })
    .from(webhookInbox)
    .where(and(eq(webhookInbox.integrationId, row.id), isNull(webhookInbox.processedAt), isNotNull(webhookInbox.error)));
  const status = STATUS[row.connectionStatus] ?? STATUS.pending;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <span aria-hidden className={`size-2 rounded-full ${status.tone}`} />
              {status.label}
            </p>
            <p className="truncate text-muted-foreground">{row.storeUrl}</p>
          </div>
          <ResyncButton />
        </div>
        <dl className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
          <Fact label="Last full import" value={row.lastSyncAt ? date(row.lastSyncAt) : "Not yet"} />
          <Fact
            label="Order updates received"
            value={`${deliveries.total}${deliveries.last ? `, latest ${date(deliveries.last)}` : ""}`}
          />
          <Fact
            label="Order webhooks"
            value={row.keyPermissions === "read_write" ? "Registered automatically" : "Set up manually in WooCommerce"}
          />
          <Fact
            label="Failed updates"
            value={failing.n ? `${failing.n} waiting to retry` : "None"}
            tone={failing.n ? "text-destructive" : undefined}
          />
        </dl>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Get Support button</h2>
          <p className="text-muted-foreground">
            Install the RelayCare plugin on your store, then paste these into WooCommerce › RelayCare. Customers will see a Get
            Support button next to each order.
          </p>
        </div>
        <dl className="space-y-3">
          <Fact label="RelayCare URL" value={appUrl} mono />
          <Fact label="Integration ID" value={row.id} mono />
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Link secret</dt>
            <dd>
              <PluginSecret />
            </dd>
          </div>
        </dl>
      </section>

      <details className="rounded-lg border bg-card p-6">
        <summary className="cursor-pointer font-semibold">Reconnect with new API keys</summary>
        <div className="mt-4 space-y-4">
          <ConnectSteps />
          <ConnectStoreForm defaultUrl={row.storeUrl} />
        </div>
      </details>
    </div>
  );
}

function Fact({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`${mono ? "font-tag break-all" : ""} ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}

function ConnectSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
      <li>In WordPress, open WooCommerce › Settings › Advanced › REST API and choose Add key.</li>
      <li>
        Pick your user and set permissions to Read/Write so RelayCare can register order webhooks for you. Read also works; you
        will add the two webhooks yourself.
      </li>
      <li>Copy the consumer key and secret into the form below.</li>
    </ol>
  );
}
