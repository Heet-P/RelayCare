"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TechnicianChoice = {
  id: string;
  name: string;
  partnerId: string | null;
  partnerName: string | null;
  serviceAreas: string[] | null;
  isAvailable: boolean;
  openJobs: number;
};

/** datetime-local value for "tomorrow 10:00" in the browser's time zone. */
function tomorrowAtTen() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(10, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Spec Journey D steps 3–6: see technicians, choose one (and optionally a service partner and
 * visit time), confirm. "Change technician" sends reassign=true; the server keeps history.
 */
export function AssignDialog({
  caseId,
  caseNumber,
  city,
  current,
  technicians,
  trigger = "Assign technician",
}: {
  caseId: string;
  caseNumber: string;
  city: string | null;
  current: { id: string; name: string } | null;
  technicians: TechnicianChoice[];
  trigger?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [partner, setPartner] = useState("all");
  const [chosen, setChosen] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");

  const partners = useMemo(() => [...new Map(technicians.filter((t) => t.partnerId).map((t) => [t.partnerId!, t.partnerName ?? "Partner"])).entries()], [technicians]);
  const covers = (t: TechnicianChoice) => !city || !t.serviceAreas?.length || t.serviceAreas.some((a) => a.toLowerCase() === city.toLowerCase());
  const list = technicians
    .filter((t) => t.id !== current?.id && (partner === "all" || t.partnerId === partner))
    .sort((a, b) => Number(covers(b)) - Number(covers(a)) || Number(b.isAvailable) - Number(a.isAvailable) || a.openJobs - b.openJobs);

  function submit() {
    start(async () => {
      const res = await fetch(`/api/cases/${caseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: chosen,
          servicePartnerId: technicians.find((t) => t.id === chosen)?.partnerId ?? undefined,
          scheduledAt: when ? new Date(when).toISOString() : undefined,
          note: note || undefined,
          reassign: !!current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.issues?.[0]?.message ?? body.error ?? "Couldn't assign the technician.");
        return;
      }
      setOpen(false);
      toast.success(`${body.technician} assigned to ${caseNumber}. Opening the service group chat.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant={current ? "outline" : "default"} className="h-11" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {current ? "Change technician" : "Assign a technician"} for {caseNumber}
              </DialogTitle>
              <DialogDescription>
                {current
                  ? `${current.name} will lose access to this case and leave the group chat.`
                  : "The technician gets the full handoff and joins a group chat with the customer, support and you."}
              </DialogDescription>
            </DialogHeader>

            {partners.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="partner">Service partner</Label>
                <select id="partner" value={partner} onChange={(e) => setPartner(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                  <option value="all">All partners</option>
                  {partners.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Technician</legend>
              {list.length === 0 && <p className="text-sm text-muted-foreground">No other active technicians. Add one in Settings, Team.</p>}
              {list.map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-checked:border-primary has-checked:ring-2 has-checked:ring-primary/20",
                    !t.isAvailable && "opacity-60",
                  )}
                >
                  <input type="radio" name="technician" value={t.id} checked={chosen === t.id} onChange={() => setChosen(t.id)} className="size-4 accent-[var(--primary)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {t.name}
                      {!t.isAvailable && <span className="ml-2 text-xs text-warning">Unavailable</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t.partnerName ?? "No partner"}
                      {t.serviceAreas?.length ? `, covers ${t.serviceAreas.join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="text-right text-xs">
                    {covers(t) && city && <span className="block font-medium text-success">Covers {city}</span>}
                    <span className="block text-muted-foreground">
                      {t.openJobs} open job{t.openJobs === 1 ? "" : "s"}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="when">Visit (optional)</Label>
              <div className="flex gap-2">
                <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11" />
                {!when && (
                  <Button type="button" variant="outline" className="h-11" onClick={() => setWhen(tomorrowAtTen())}>
                    Tomorrow 10:00
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Leave empty to let the technician agree a time with the customer.</p>
            </div>

            {current && (
              <div className="space-y-2">
                <Label htmlFor="note">Reason for the change</Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ravi is on leave" className="h-11" />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
                Back
              </Button>
              <Button type="submit" className="h-11" disabled={pending || !chosen}>
                {pending ? "Assigning…" : current ? "Change technician" : "Assign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Book or move the visit (dispatcher or the assigned technician). */
export function ScheduleDialog({ caseId, scheduledAt, trigger }: { caseId: string; scheduledAt: Date | null; trigger?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const initial = scheduledAt ? new Date(scheduledAt.getTime() - scheduledAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : tomorrowAtTen();
  const [when, setWhen] = useState(initial);

  function submit() {
    start(async () => {
      const res = await fetch(`/api/cases/${caseId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(when).toISOString() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.issues?.[0]?.message ?? body.error ?? "Couldn't book the visit.");
        return;
      }
      setOpen(false);
      toast.success("Visit booked");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        {trigger ?? (scheduledAt ? "Move visit" : "Book visit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{scheduledAt ? "Move the visit" : "Book the visit"}</DialogTitle>
              <DialogDescription>The customer sees the new time on their case page.</DialogDescription>
            </DialogHeader>
            <Input type="datetime-local" aria-label="Visit time" value={when} onChange={(e) => setWhen(e.target.value)} required className="h-11" />
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
                Back
              </Button>
              <Button type="submit" className="h-11" disabled={pending || !when}>
                {pending ? "Saving…" : "Save visit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
