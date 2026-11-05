"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Shown while the case waits on the customer: what was asked, and a way to hand it back. */
export function InfoRequest({ caseId, question, agent }: { caseId: string; question: string | null; agent: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-lg border-2 border-baton bg-card p-4" aria-label="Information requested">
      <p className="font-semibold">{agent} asked:</p>
      <p className="whitespace-pre-line">{question ?? "Please reply in the conversation below."}</p>
      <p className="text-sm text-muted-foreground">Answer in the conversation or add photos below, then let {agent} know.</p>
      <Button
        className="h-11"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await fetch(`/api/cases/${caseId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to: "under_triage" }),
            });
            if (!res.ok) {
              toast.error((await res.json().catch(() => ({}))).error ?? "Couldn't update your case.");
              return;
            }
            toast.success(`Thanks. ${agent} will take it from here.`);
            router.refresh();
          })
        }
      >
        {pending ? "Sending…" : "I've added the information"}
      </Button>
    </section>
  );
}
