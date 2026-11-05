"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";

const OUTCOMES = [
  { value: "repair", label: "Repaired" },
  { value: "replacement", label: "Product needs replacing" },
  { value: "no_fault_found", label: "No fault found" },
  { value: "not_covered", label: "Not covered (damage or misuse)" },
] as const;

const area = "w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Spec Journey E: start work at the visit, then file the completion report. The case moves to
 * "awaiting customer confirmation"; only the customer can mark it resolved.
 */
export function WorkPanel({ caseId, status, photoCount, t }: { caseId: string; status: string; photoCount: number; t: Messages }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<string>("repair");
  const [findings, setFindings] = useState("");
  const [work, setWork] = useState("");
  const [parts, setParts] = useState<string[]>([]);
  const [part, setPart] = useState("");
  const [notes, setNotes] = useState("");

  const call = (url: string, method: string, body: object, done: string) =>
    start(async () => {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.issues?.[0]?.message ?? json.error ?? "That didn't go through.");
        return;
      }
      toast.success(done);
      router.refresh();
    });

  if (status === "scheduled") {
    return (
      <section className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-muted-foreground">At the customer&apos;s? Start the job so they can see you&apos;re working on it.</p>
        <Button className="h-11 w-full" disabled={pending} onClick={() => call(`/api/cases/${caseId}/status`, "PATCH", { to: "in_progress" }, "Work started")}>
          {pending ? "…" : t.startWork}
        </Button>
      </section>
    );
  }
  if (status !== "in_progress") return null;

  return (
    <form
      className="space-y-4 rounded-lg border-2 border-primary bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        call(
          `/api/cases/${caseId}/resolution`,
          "POST",
          { resolutionType: outcome, findings, workPerformed: work, partsReplaced: parts, notes: notes || undefined },
          "Report sent. The customer will be asked to confirm.",
        );
      }}
    >
      <h2 className="text-lg font-semibold">Completion report</h2>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">Outcome</legend>
        {OUTCOMES.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent">
            <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="size-4 accent-[var(--primary)]" />
            {o.label}
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="findings">What you found</Label>
        <textarea id="findings" rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} className={area} placeholder="Drain hose clamp loose, water escaping during spin" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="work">Work done</Label>
        <textarea id="work" rows={3} value={work} onChange={(e) => setWork(e.target.value)} className={area} placeholder="Replaced drain hose clamp, ran a test wash, no leak" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="part">Parts replaced</Label>
        {parts.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {parts.map((p, i) => (
              <li key={i} className="flex items-center gap-1 rounded-sm bg-secondary py-1 pr-1 pl-3 text-sm">
                {p}
                <button type="button" aria-label={`Remove ${p}`} onClick={() => setParts(parts.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-sm hover:bg-accent">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id="part"
            value={part}
            onChange={(e) => setPart(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (part.trim()) setParts([...parts, part.trim()]);
                setPart("");
              }
            }}
            placeholder="Drain hose clamp"
            className="h-11"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={!part.trim()}
            onClick={() => {
              setParts([...parts, part.trim()]);
              setPart("");
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes for the customer (optional)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" placeholder="Keep the hose clear of the wall" />
      </div>
      {photoCount === 0 && <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">Add at least one photo of your inspection or repair (below) before sending the report.</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending || photoCount === 0 || findings.trim().length < 5 || work.trim().length < 5}>
        {pending ? "…" : t.completeWork}
      </Button>
    </form>
  );
}
