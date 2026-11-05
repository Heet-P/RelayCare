"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPolicy, setPolicyActive, type PolicyState } from "./actions";

/** Optimistic on/off switch for a rule. */
export function PolicyToggle({ id, active }: { id: string; active: boolean }) {
  const [shown, setShown] = useOptimistic(active);
  const [, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      onClick={() =>
        start(async () => {
          setShown(!shown);
          await setPolicyActive(id, !shown);
          toast.success(shown ? "Rule switched off" : "Rule switched on");
        })
      }
    >
      {shown ? "Switch off" : "Switch on"}
    </Button>
  );
}

export function PolicyForm() {
  const [match, setMatch] = useState("sku_prefix");
  const [state, action, pending] = useActionState<PolicyState, FormData>(async (prev, form) => {
    const res = await createPolicy(prev, form);
    if (res.ok) toast.success("Rule added");
    return res;
  }, {});
  return (
    <form action={action} className="space-y-4 panel rounded-xl p-6">
      <h2 className="text-lg font-semibold">Add a rule</h2>
      <div className="space-y-2">
        <Label htmlFor="p-name">Name</Label>
        <Input id="p-name" name="name" placeholder="Televisions, 24 months" required className="h-11" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-match">Applies to</Label>
          <select
            id="p-match"
            name="matchType"
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="sku_prefix">SKUs starting with…</option>
            <option value="product_id">One WooCommerce product ID</option>
            <option value="all">Every product</option>
          </select>
        </div>
        {match !== "all" && (
          <div className="space-y-2">
            <Label htmlFor="p-value">{match === "sku_prefix" ? "SKU prefix" : "Product ID"}</Label>
            <Input id="p-value" name="matchValue" className="font-tag h-11" placeholder={match === "sku_prefix" ? "TV-" : "123"} />
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="p-months">Months of cover</Label>
          <Input id="p-months" name="durationMonths" type="number" min={1} max={120} defaultValue={12} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-start">Starts from</Label>
          <select id="p-start" name="startBasis" defaultValue="completed" className="h-11 w-full rounded-md border border-input bg-background px-3">
            <option value="completed">Delivery (order completed)</option>
            <option value="ordered">Order date</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-priority">Priority</Label>
          <Input id="p-priority" name="priority" type="number" min={0} max={100} defaultValue={5} className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-notes">What it covers (optional)</Label>
        <Input id="p-notes" name="coverageNotes" placeholder="Panel and power faults. Excludes screen damage." className="h-11" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Adding…" : "Add rule"}
      </Button>
    </form>
  );
}
