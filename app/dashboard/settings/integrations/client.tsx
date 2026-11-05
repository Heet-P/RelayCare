"use client";

import { Copy, Eye, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConnectWooResult } from "@/lib/contracts/integrations";
import { resyncOrders, revealLinkSecret } from "./actions";

/** Connect (or reconnect) a WooCommerce store through the connect API. */
export function ConnectStoreForm({ defaultUrl }: { defaultUrl?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<ConnectWooResult | null>(null);

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/integrations/woocommerce/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.issues?.[0]?.message ?? body.error ?? "Could not connect the store.");
        return;
      }
      const result = body as ConnectWooResult;
      toast.success("Store connected. Importing orders now.");
      if (result.webhooks === "manual") setManual(result);
      router.refresh();
    });
  }

  if (manual) return <ManualWebhooks result={manual} />;

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="storeUrl">Store URL</Label>
        <Input
          id="storeUrl"
          name="storeUrl"
          type="url"
          placeholder="https://shop.example.com"
          defaultValue={defaultUrl}
          required
          className="h-11"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consumerKey">Consumer key</Label>
          <Input id="consumerKey" name="consumerKey" autoComplete="off" spellCheck={false} placeholder="ck_…" required className="font-tag h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consumerSecret">Consumer secret</Label>
          <Input
            id="consumerSecret"
            name="consumerSecret"
            type="password"
            autoComplete="off"
            placeholder="cs_…"
            required
            className="font-tag h-11"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Checking keys…" : "Connect store"}
      </Button>
    </form>
  );
}

/** Read-only keys: the merchant adds the two webhooks by hand. */
function ManualWebhooks({ result }: { result: ConnectWooResult }) {
  return (
    <div className="space-y-3">
      <p>These keys are read-only, so add two webhooks in WooCommerce › Settings › Advanced › Webhooks:</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>One with topic Order created and one with topic Order updated, both Active.</li>
        <li>Use the delivery URL and secret below for both.</li>
      </ul>
      <CopyField label="Delivery URL" value={result.deliveryUrl} />
      <CopyField label="Secret" value={result.webhookSecret ?? ""} />
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-tag break-all">{value}</p>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      aria-label={`Copy ${label}`}
      onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`))}
    >
      <Copy className="size-4" />
    </button>
  );
}

/** The plugin's link secret, fetched only when the owner asks to see it. */
export function PluginSecret() {
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (secret) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-tag min-w-0 flex-1 break-all">{secret}</span>
        <CopyButton value={secret} label="Link secret" />
      </span>
    );
  }
  return (
    <Button variant="outline" className="h-11" disabled={pending} onClick={() => start(async () => setSecret(await revealLinkSecret()))}>
      <Eye className="size-4" /> Show secret
    </Button>
  );
}

export function ResyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { ok } = await resyncOrders();
          if (ok) toast.success("Re-importing orders. Existing orders are updated, never duplicated.");
          else toast.error("Connect a store first.");
          router.refresh();
        })
      }
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> Re-sync orders
    </Button>
  );
}
