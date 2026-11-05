"use client";

import { Camera, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ISSUE_CATEGORIES, type IssueCategory } from "@/lib/cases/categories";
import { EVIDENCE_LIMITS } from "@/lib/contracts/cases";
import { uploadEvidence } from "@/lib/evidence-upload";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type WizardItem = { id: string; orderId: string; orderNumber: string; name: string; serialNumber: string | null };

const STEPS = ["Product", "What's wrong", "Details", "Photos", "Review"] as const;
const MAX_FILES = 6;

/** Spec Journey B steps 5–10: choose product → category → describe → evidence → create case. */
export function ReportWizard({ items, preselected, t }: { items: WizardItem[]; preselected?: string; t: Messages }) {
  const router = useRouter();
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [itemId, setItemId] = useState(preselected ?? (items.length === 1 ? items[0].id : ""));
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [description, setDescription] = useState("");
  const [tried, setTried] = useState<string[]>([]);
  const [triedDraft, setTriedDraft] = useState("");
  const [serial, setSerial] = useState(() => items.find((i) => i.id === itemId)?.serialNumber ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; caseId?: string } | null>(null);
  const item = items.find((i) => i.id === itemId);

  const canContinue = [!!itemId, !!category, description.trim().length >= 10, true, true][step];

  function chooseItem(id: string) {
    setItemId(id);
    setSerial(items.find((i) => i.id === id)?.serialNumber ?? "");
  }

  function addTried() {
    const t = triedDraft.trim();
    if (t && tried.length < 10) setTried([...tried, t]);
    setTriedDraft("");
  }

  function addFiles(list: FileList | null) {
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      const limit = EVIDENCE_LIMITS[f.type as keyof typeof EVIDENCE_LIMITS];
      if (!limit) toast.error(`${f.name}: use a photo (JPG, PNG), MP4 video or PDF.`);
      else if (f.size > limit) toast.error(`${f.name} is larger than ${limit / 1024 / 1024} MB.`);
      else if (next.length < MAX_FILES) next.push(f);
    }
    setFiles(next);
  }

  async function submit() {
    setError(null);
    setBusy("Creating your case…");
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderItemId: itemId, category, description, troubleshooting: tried, serialNumber: serial || undefined }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBusy(null);
      // 409: an open case already exists for this product; `code` carries its id.
      setError({ message: body.issues?.[0]?.message ?? body.error ?? "Could not create the case.", caseId: res.status === 409 ? body.code : undefined });
      return;
    }
    let failed = 0;
    for (const [i, f] of files.entries()) {
      setBusy(`Uploading ${files.length > 1 ? `file ${i + 1} of ${files.length}` : "your file"}…`);
      try {
        await uploadEvidence(body.caseId, f);
      } catch {
        failed++;
      }
    }
    if (failed) toast.error(`${failed} file(s) didn't upload. You can add them from your case page.`);
    toast.success(`Case ${body.caseNumber} created`);
    router.push(`/my-cases/${body.caseId}`);
  }

  return (
    <div className="space-y-6 pb-24">
      <ol className="flex gap-1" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
            <span className="sr-only">
              Step {i + 1} of {STEPS.length}: {s}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        {t.step} {step + 1} {t.of} {STEPS.length}
      </p>

      {step === 0 && (
        <fieldset className="space-y-4">
          <legend className="text-xl font-semibold tracking-tight">{t.whichProduct}</legend>
          <div className="space-y-2">
            {items.map((i) => (
              <label
                key={i.id}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-3 panel rounded-xl px-4 py-3 has-checked:border-primary has-checked:ring-2 has-checked:ring-primary/20",
                )}
              >
                <input type="radio" name="item" className="size-5 accent-[var(--primary)]" checked={itemId === i.id} onChange={() => chooseItem(i.id)} />
                <span>
                  <span className="block font-medium">{i.name}</span>
                  <span className="font-tag block text-sm text-muted-foreground">Order #{i.orderNumber}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="space-y-4">
          <legend className="text-xl font-semibold tracking-tight">{t.whatsWrong} {item?.name}?</legend>
          <div className="grid grid-cols-2 gap-2">
            {ISSUE_CATEGORIES.map((c) => (
              <label
                key={c.key}
                className="flex min-h-14 cursor-pointer items-center panel rounded-xl px-4 py-3 text-sm font-medium has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground"
              >
                <input type="radio" name="category" className="sr-only" checked={category === c.key} onChange={() => setCategory(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">{t.tellUs}</h2>
          <div className="space-y-2">
            <Label htmlFor="description">{t.problem}</Label>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="For example: water leaks from the bottom during the wash cycle."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-sm text-muted-foreground">{t.anyLanguage}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tried">{t.triedLabel}</Label>
            {tried.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {tried.map((t, i) => (
                  <li key={i} className="flex items-center gap-1 rounded-sm bg-secondary py-1 pr-1 pl-3 text-sm">
                    {t}
                    <button type="button" className="grid size-8 place-items-center rounded-sm hover:bg-accent" aria-label={`Remove ${t}`} onClick={() => setTried(tried.filter((_, j) => j !== i))}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id="tried"
                value={triedDraft}
                onChange={(e) => setTriedDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTried())}
                placeholder="Checked the inlet pipe"
                className="h-11"
              />
              <Button type="button" variant="outline" className="h-11" onClick={addTried} disabled={!triedDraft.trim()}>
                <Plus className="size-4" /> {t.add}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t.triedHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">{t.serial}</Label>
            <Input id="serial" value={serial} onChange={(e) => setSerial(e.target.value)} className="font-tag h-11" placeholder="On the label behind the door or on the back" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">{t.addMedia}</h2>
          <p className="text-muted-foreground">
            {t.addMediaHint} ({MAX_FILES} max)
          </p>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card p-4 text-center hover:border-primary">
            <Camera className="size-6 text-muted-foreground" aria-hidden />
            <span className="font-medium">{t.chooseMedia}</span>
            <span className="text-sm text-muted-foreground">Photos up to 10 MB, videos up to 50 MB</span>
            <input type="file" accept="image/*,video/mp4,video/quicktime,application/pdf" multiple className="sr-only" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          </label>
          {files.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <li key={i} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                  {f.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={URL.createObjectURL(f)} alt={f.name} className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center p-2 text-center text-xs break-all">{f.name}</span>
                  )}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-1 right-1 grid size-9 place-items-center rounded-full bg-background/90" aria-label={`Remove ${f.name}`}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">{t.checkAndSend}</h2>
          <dl className="divide-y panel rounded-xl">
            <Row label="Product" value={`${item?.name} (Order #${item?.orderNumber})`} />
            <Row label="Problem" value={ISSUE_CATEGORIES.find((c) => c.key === category)?.label ?? ""} />
            <Row label="Description" value={description} />
            {tried.length > 0 && <Row label="Already tried" value={tried.join("; ")} />}
            {serial && <Row label="Serial number" value={serial} />}
            <Row label="Attachments" value={files.length ? `${files.length} file(s)` : "None"} />
          </dl>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}{" "}
              {error.caseId && (
                <Link className="font-medium underline" href={`/my-cases/${error.caseId}`}>
                  Open that case
                </Link>
              )}
            </p>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-14 z-10 border-t bg-background/95 backdrop-blur sm:static sm:border-0 sm:bg-transparent">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 sm:px-0">
          {step > 0 && (
            <Button variant="outline" className="h-11" onClick={() => setStep(step - 1)} disabled={!!busy}>
              {t.back}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button className="h-11 flex-1 sm:flex-none" onClick={() => setStep(step + 1)} disabled={!canContinue}>
              {t.continue}
            </Button>
          ) : (
            <Button className="h-11 flex-1 sm:flex-none" onClick={submit} disabled={!!busy}>
              {busy ?? t.send}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words whitespace-pre-line">{value}</dd>
    </div>
  );
}
