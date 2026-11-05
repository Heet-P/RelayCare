"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  caseId: string;
  caseNumber: string;
  customerTried: string[];
  attachments: { id: string; fileName: string }[];
  /** Dispatch requires a recorded warranty decision (eligible or exception). */
  warrantyReady: boolean;
};

/** Spec Journey C step 9: the agent prepares the structured handoff and sends the case to dispatch. */
export function HandoffBuilder({ caseId, caseNumber, customerTried, attachments, warrantyReady }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [tried, setTried] = useState<string[]>(customerTried.map((t) => `Customer: ${t}`));
  const [action, setAction] = useState("");
  const [priority, setPriority] = useState("normal");
  const [evidence, setEvidence] = useState<string[]>(attachments.map((a) => a.id));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/cases/${caseId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms, troubleshooting: tried, actionRequired: action, priority, attachmentIds: evidence, notes: notes || undefined, sendToDispatch: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.issues?.[0]?.message ?? body.error ?? "Couldn't save the handoff.");
        return;
      }
      setOpen(false);
      toast.success(`${caseNumber} handed to dispatch`);
      router.refresh();
    });
  }

  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        Prepare handoff
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Handoff for {caseNumber}</DialogTitle>
              <DialogDescription>
                The technician receives this with the original complaint, product, serial, warranty and customer contact. Nobody asks the customer again.
              </DialogDescription>
            </DialogHeader>

            <ListField label="Symptoms" placeholder="Leakage occurs during wash cycle" items={symptoms} onChange={setSymptoms} />
            <ListField label="Already tried" placeholder="Customer checked inlet pipe" items={tried} onChange={setTried} />

            <div className="space-y-2">
              <Label htmlFor="action">Required action</Label>
              <Input id="action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Inspect drain connection and internal water path" className="h-11" />
            </div>

            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes for dispatch (optional)</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Customer prefers morning visits" className="h-11" />
              </div>
            </div>

            {attachments.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="mb-1 text-sm font-medium">Include evidence</legend>
                {attachments.map((a) => (
                  <label key={a.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={evidence.includes(a.id)}
                      onChange={(e) => setEvidence(e.target.checked ? [...evidence, a.id] : evidence.filter((x) => x !== a.id))}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {a.fileName}
                  </label>
                ))}
              </fieldset>
            )}

            {!warrantyReady && <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">Record the warranty decision before sending this case to dispatch.</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
                Keep editing later
              </Button>
              <Button type="submit" className="h-11" disabled={pending || !warrantyReady || !symptoms.length || action.trim().length < 3}>
                {pending ? "Sending…" : "Send to dispatch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ListField({ label, placeholder, items, onChange }: { label: string; placeholder: string; items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const id = label.toLowerCase().replace(/\W+/g, "-");
  const add = () => {
    if (draft.trim()) onChange([...items, draft.trim()]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((t, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-secondary pl-3 text-sm">
              <span className="flex-1 py-2">{t}</span>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-md hover:bg-accent" aria-label={`Remove ${t}`}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder={placeholder} className="h-11" />
        <Button type="button" variant="outline" className="h-11" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
