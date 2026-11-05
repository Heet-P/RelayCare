import { Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EvidenceGrid } from "@/components/cases/evidence";
import { HandoffCard } from "@/components/cases/handoff-card";
import { StatusChip } from "@/components/cases/status-chip";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ScheduleDialog } from "@/components/dispatch/assign-dialog";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { JobResponse } from "@/components/technician/job-response";
import { WorkPanel } from "@/components/technician/work-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCaseAccess } from "@/lib/auth/access";
import { requireActor } from "@/lib/auth/session";
import { chatChannelsFor } from "@/lib/cases/chat-channels";
import { getCaseView } from "@/lib/db/queries/case-view";

export const metadata: Metadata = { title: "Job" };

const visitText = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);

/** "YYYY-MM-DDTHH:mm" in India time, for a datetime-local input. */
function localInput(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export default function JobPage({ params }: PageProps<"/technician/jobs/[caseId]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      }
    >
      {params.then(({ caseId }) => (
        <Job caseId={caseId} />
      ))}
    </Suspense>
  );
}

async function Job({ caseId }: { caseId: string }) {
  const actor = await requireActor();
  const access = await resolveCaseAccess(actor, caseId);
  // Technicians reach only cases they are an active participant of; anything else is "not found".
  if (!access || access.role !== "technician") notFound();
  const view = await getCaseView(actor.authUserId, caseId);
  if (!view) notFound();

  const c = view.case;
  const mine = view.assignments.find((a) => a.technicianId === actor.user.id && (a.assignmentStatus === "assigned" || a.assignmentStatus === "accepted" || a.assignmentStatus === "completed"));
  const handoff = view.handoffs.find((h) => h.toUserId === actor.user.id) ?? view.handoffs[0];
  const { channels, names } = chatChannelsFor(view, "technician", actor.user.id);
  const phone = view.customer.phone ?? c.serviceAddress?.phone ?? null;
  const address = c.serviceAddress ? [c.serviceAddress.line1, c.serviceAddress.line2, c.serviceAddress.city, c.serviceAddress.postcode].filter(Boolean).join(", ") : null;
  const accepted = mine?.assignmentStatus === "accepted";

  return (
    <div className="space-y-6">
      <LiveRefresh table="service_cases" />
      <Link href="/technician/jobs" className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        All jobs
      </Link>
      <header className="space-y-2">
        <p className="font-tag text-sm text-muted-foreground">{c.caseNumber}</p>
        <h1 className="text-xl font-semibold tracking-tight">{view.item.name}</h1>
        <StatusChip status={c.status} />
      </header>

      {mine?.assignmentStatus === "assigned" && <JobResponse caseId={c.id} proposedAt={mine.scheduledAt ? localInput(mine.scheduledAt) : null} />}

      {handoff ? (
        <HandoffCard snapshot={handoff.contextSnapshot} compact />
      ) : (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Customer complaint</h2>
          <p className="whitespace-pre-line">{c.description}</p>
        </section>
      )}

      <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="Visit and contact">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Visit</p>
            <p className="font-semibold">{mine?.scheduledAt ? visitText(mine.scheduledAt) : "Not booked yet"}</p>
          </div>
          {accepted && (c.status === "assigned" || c.status === "scheduled") && <ScheduleDialog caseId={c.id} scheduledAt={mine?.scheduledAt ?? null} />}
        </div>
        <div className="border-t pt-3">
          <p className="font-medium">{view.customer.name}</p>
          {address && <p className="text-muted-foreground">{address}</p>}
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-3 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground">
              <Phone className="size-4" aria-hidden /> Call {phone}
            </a>
          )}
        </div>
      </section>

      {accepted && (
        <WorkPanel
          caseId={c.id}
          status={c.status}
          photoCount={view.attachments.filter((a) => a.uploadedBy === actor.user.id && (a.purpose === "inspection" || a.purpose === "repair")).length}
        />
      )}

      <ChatPanel channels={channels} names={names} locale={actor.user.locale} className="h-[28rem]" />

      <EvidenceGrid view={view} canAdd={accepted && !["closed", "cancelled", "rejected", "resolved"].includes(c.status)} />
    </div>
  );
}
