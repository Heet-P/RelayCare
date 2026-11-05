"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";

/** Accept the job (optionally booking the visit) or decline it with a reason for dispatch. */
export function JobResponse({ caseId, proposedAt, t }: { caseId: string; proposedAt: string | null; t: Messages }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState(proposedAt ?? "");

  const send = (body: object, done: string) =>
    start(async () => {
      const res = await fetch(`/api/cases/${caseId}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.issues?.[0]?.message ?? json.error ?? "That didn't go through.");
        return;
      }
      toast.success(done);
      router.push(json.status === "rejected" ? "/technician/jobs" : `/technician/jobs/${caseId}`);
      router.refresh();
    });

  if (declining) {
    return (
      <form
        className="space-y-3 panel rounded-xl p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send({ action: "reject", reason }, "Job declined. Dispatch will reassign it.");
        }}
      >
        <Label htmlFor="reason">Why can&apos;t you take this job?</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No spare drain pump in my van" className="h-11" />
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" className="h-11" disabled={pending || reason.trim().length < 3}>
            Decline job
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => setDeclining(false)}>
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className="space-y-3 panel rounded-xl ring-2 ring-baton p-4" aria-label="New job">
      <p className="font-semibold">Dispatch has offered you this job</p>
      <div className="space-y-2">
        <Label htmlFor="visit">Visit time (optional)</Label>
        <Input id="visit" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 flex-1"
          disabled={pending}
          onClick={() => send({ action: "accept", scheduledAt: when ? new Date(when).toISOString() : undefined }, "Job accepted")}
        >
          {pending ? "…" : t.acceptJob}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setDeclining(true)} disabled={pending}>
          {t.decline}
        </Button>
      </div>
    </section>
  );
}
