"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";
import { RESOLUTION_LABEL } from "@/lib/cases/labels";
import { cn } from "@/lib/utils";

export type RepairReport = {
  resolutionType: string;
  findings: string;
  workPerformed: string;
  partsReplaced: string[];
  notes?: string;
};

const OUTCOME = RESOLUTION_LABEL;

async function post(url: string, method: string, body: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.issues?.[0]?.message ?? json.error ?? "That didn't go through.");
}

/** Spec Journey E steps 9–10: the customer reviews the result and confirms or rejects it. */
export function ResolutionReview({ t, caseId, technician, report, deskNotes }: { t: Messages; caseId: string; technician: string | null; report: RepairReport | null; deskNotes: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notFixed, setNotFixed] = useState(false);
  const [reason, setReason] = useState("");

  const act = (body: object, done: string) =>
    start(async () => {
      try {
        await post(`/api/cases/${caseId}/status`, "PATCH", body);
        toast.success(done);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <section className="space-y-4 panel rounded-xl ring-2 ring-amber p-4" aria-label="Confirm the repair">
      <h2 className="text-lg font-semibold">{technician ? `${technician}'s report` : "Proposed resolution"}</h2>
      {report ? (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Outcome</dt>
            <dd className="font-medium">{OUTCOME[report.resolutionType] ?? report.resolutionType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">What was found</dt>
            <dd>{report.findings}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Work done</dt>
            <dd>{report.workPerformed}</dd>
          </div>
          {report.partsReplaced.length > 0 && (
            <div>
              <dt className="text-muted-foreground">Parts replaced</dt>
              <dd>{report.partsReplaced.join(", ")}</dd>
            </div>
          )}
          {report.notes && (
            <div>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{report.notes}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p>{deskNotes}</p>
      )}
      {notFixed ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            act({ to: "reopened", reason }, "Thanks for telling us. The team will look at it again.");
          }}
        >
          <label htmlFor="still" className="text-sm font-medium">
            {t.stillWrong}
          </label>
          <textarea
            id="still"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2">
            <Button type="submit" className="h-11" disabled={pending || !reason.trim()}>
              Send
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setNotFixed(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 flex-1" disabled={pending} onClick={() => act({ to: "resolved" }, "Thanks for confirming!")}>
            {t.isFixed}
          </Button>
          <Button variant="outline" className="h-11" disabled={pending} onClick={() => setNotFixed(true)}>
            {t.notFixed}
          </Button>
        </div>
      )}
    </section>
  );
}

/** One-tap 1–5 rating once the case is resolved. Optimistic: shows the rating immediately. */
export function RateService({ t, caseId, existing }: { t: Messages; caseId: string; existing: number | null }) {
  const [score, setScore] = useState(existing ?? 0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(existing != null);
  const [pending, start] = useTransition();

  if (sent) return <p className="panel rounded-xl p-4 text-sm">Thanks for rating us {score} out of 5.</p>;
  return (
    <section className="space-y-3 panel rounded-xl p-4" aria-label="Rate the service">
      <p className="font-semibold">{t.rate}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={`${n} out of 5`}
            onClick={() => setScore(n)}
            className="grid size-11 place-items-center rounded-md hover:bg-accent"
          >
            <Star className={cn("size-6", n <= score ? "fill-amber text-amber" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything we should know? (optional)"
        aria-label="Comment"
        className="h-11 w-full rounded-md border border-input bg-background px-3"
      />
      <Button
        className="h-11"
        disabled={!score || pending}
        onClick={() =>
          start(async () => {
            setSent(true);
            try {
              await post(`/api/cases/${caseId}/feedback`, "POST", { score, comment: comment || undefined });
            } catch (e) {
              setSent(false);
              toast.error((e as Error).message);
            }
          })
        }
      >
        {t.sendRating}
      </Button>
    </section>
  );
}
