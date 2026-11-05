"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHOICES = [
  { value: "eligible", label: "Covered" },
  { value: "exception", label: "Covered as an exception" },
  { value: "expired", label: "Expired" },
  { value: "not_covered", label: "Not covered" },
  { value: "pending", label: "Still checking" },
] as const;

const LABEL: Record<string, string> = {
  unverified: "Not verified yet",
  pending: "Still checking",
  eligible: "Covered",
  exception: "Covered as an exception",
  expired: "Expired",
  not_covered: "Not covered",
};

export type WarrantyInfo = {
  status: string;
  notes: string | null;
  verifiedBy: string | null;
  policyName: string | null;
  coverageNotes: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  /** Days of cover left at render time (negative = expired). */
  daysLeft: number | null;
};

/**
 * Warranty verification (spec §5): the store policy only SUGGESTS dates; a person decides.
 * The decision, its author and notes are recorded and shown in the timeline.
 */
export function WarrantyPanel({ caseId, info, canEdit }: { caseId: string; info: WarrantyInfo; canEdit: boolean }) {
  const router = useRouter();
  const [shown, setShown] = useOptimistic(info.status);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<string>(info.daysLeft != null && info.daysLeft >= 0 ? "eligible" : "expired");
  const [notes, setNotes] = useState("");

  function save() {
    start(async () => {
      setShown(choice);
      setEditing(false);
      const res = await fetch(`/api/cases/${caseId}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: choice, notes: notes || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.issues?.[0]?.message ?? body.error ?? "Couldn't save the warranty decision.");
        setEditing(true);
        return;
      }
      toast.success(`Warranty recorded: ${LABEL[choice].toLowerCase()}`);
      router.refresh();
    });
  }

  const verified = shown !== "unverified" && shown !== "pending";
  return (
    <section className="space-y-3" aria-label="Warranty">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Warranty</h2>
        <span className={cn("text-sm font-medium", verified ? (shown === "eligible" || shown === "exception" ? "text-success" : "text-destructive") : "text-warning")}>
          {LABEL[shown] ?? shown}
          {pending && " …"}
        </span>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {info.policyName ? (
          <p>
            Store policy “{info.policyName}” suggests cover until <span className="text-foreground">{info.expiresAt ?? "unknown"}</span>
            {info.daysLeft != null && (info.daysLeft >= 0 ? `, ${info.daysLeft} days left.` : `, ended ${-info.daysLeft} days ago.`)}
          </p>
        ) : (
          <p>No store policy matches this product. Check the manufacturer&apos;s terms.</p>
        )}
        {info.coverageNotes && <p>Covers: {info.coverageNotes}</p>}
        {info.verifiedBy && verified && (
          <p>
            Recorded by {info.verifiedBy}
            {info.notes ? `: ${info.notes}` : "."}
          </p>
        )}
      </div>
      {canEdit && !editing && (
        <Button variant={verified ? "outline" : "default"} className="h-11" onClick={() => setEditing(true)} disabled={pending}>
          {verified ? "Change decision" : "Verify warranty"}
        </Button>
      )}
      {canEdit && editing && (
        <form
          className="space-y-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset className="space-y-1">
            <legend className="sr-only">Warranty decision</legend>
            {CHOICES.map((c) => (
              <label key={c.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent">
                <input type="radio" name="warranty" value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} className="size-4 accent-[var(--primary)]" />
                {c.label}
              </label>
            ))}
          </fieldset>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={choice === "exception" ? "Why is this an exception? (required)" : "Notes (optional)"}
            aria-label="Warranty notes"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2">
            <Button type="submit" className="h-11" disabled={choice === "exception" && !notes.trim()}>
              Save decision
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
