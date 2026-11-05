"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ACTION_LABEL, STATUS_LABEL } from "@/lib/cases/labels";
import type { CaseStatus } from "@/lib/cases/state-machine";

export type CaseAction = { action: string; to: CaseStatus; needsReason: boolean; tone?: "primary" | "danger" };

const DESK_RESOLUTIONS = [
  { value: "replacement", label: "Replace the product" },
  { value: "return", label: "Take the product back" },
  { value: "refund", label: "Refund (processed outside RelayCare)" },
  { value: "not_covered", label: "Not covered by warranty" },
];

const PROMPT: Record<string, { title: string; hint: string }> = {
  request_info: { title: "What do you need from the customer?", hint: "They see this in their case and can reply in the conversation." },
  reject: { title: "Why can't this case be taken on?", hint: "The customer sees this reason." },
  escalate: { title: "Why does this need escalating?", hint: "Dispatch and the store owner will see this." },
  cancel: { title: "Why is this case being cancelled?", hint: "Recorded in the case history." },
  unassign: { title: "Why is the technician being removed?", hint: "Recorded in the case history." },
  reject_resolution: { title: "What is still wrong?", hint: "The team will review it." },
  propose_desk_resolution: { title: "Resolve without a technician visit", hint: "The customer is asked to confirm. RelayCare records the decision; refunds and replacements are processed in your store." },
};

/**
 * Status actions allowed for this viewer (computed on the server from the state machine).
 * Optimistic: the status label changes at once and rolls back with a toast if the server refuses.
 */
export function CaseActions({ caseId, status, actions }: { caseId: string; status: CaseStatus; actions: CaseAction[] }) {
  const router = useRouter();
  const [shown, setShown] = useOptimistic(status);
  const [pending, start] = useTransition();
  const [prompt, setPrompt] = useState<CaseAction | null>(null);

  function run(a: CaseAction, extra: Record<string, string> = {}) {
    setPrompt(null);
    start(async () => {
      setShown(a.to);
      const res = await fetch(`/api/cases/${caseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: a.to, ...extra }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "That change didn't go through.");
        return; // optimistic state reverts when the transition ends
      }
      toast.success(`${ACTION_LABEL[a.action] ?? "Updated"}: ${STATUS_LABEL[a.to].toLowerCase()}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" aria-live="polite">
        Status <span className="font-semibold">{STATUS_LABEL[shown]}</span>
        {pending && <span className="text-muted-foreground"> (saving…)</span>}
      </p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.action}
              variant={a.tone === "primary" ? "default" : a.tone === "danger" ? "destructive" : "outline"}
              className="h-11"
              disabled={pending}
              onClick={() => (a.needsReason ? setPrompt(a) : run(a))}
            >
              {ACTION_LABEL[a.action] ?? a.action}
            </Button>
          ))}
        </div>
      )}
      <ReasonDialog action={prompt} onClose={() => setPrompt(null)} onSubmit={run} />
    </div>
  );
}

function ReasonDialog({ action, onClose, onSubmit }: { action: CaseAction | null; onClose: () => void; onSubmit: (a: CaseAction, extra: Record<string, string>) => void }) {
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState(DESK_RESOLUTIONS[0].value);
  const p = action ? PROMPT[action.action] ?? { title: ACTION_LABEL[action.action], hint: "" } : null;
  const desk = action?.action === "propose_desk_resolution";

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {action && p && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(action, desk ? { resolutionType: resolution, resolutionNotes: reason } : { reason });
              setReason("");
            }}
          >
            <DialogHeader>
              <DialogTitle>{p.title}</DialogTitle>
              {p.hint && <DialogDescription>{p.hint}</DialogDescription>}
            </DialogHeader>
            {desk && (
              <div className="space-y-2">
                <Label htmlFor="resolution">Decision</Label>
                <select id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                  {DESK_RESOLUTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">{desk ? "Notes for the customer" : "Reason"}</Label>
              <textarea
                id="reason"
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                Back
              </Button>
              <Button type="submit" className="h-11" disabled={!reason.trim()}>
                {ACTION_LABEL[action.action]}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
