import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseActions, type CaseAction } from "@/components/cases/case-actions";
import { EvidenceGrid } from "@/components/cases/evidence";
import { HandoffBuilder } from "@/components/cases/handoff-builder";
import { HandoffCard } from "@/components/cases/handoff-card";
import { PriorityMark, StatusChip } from "@/components/cases/status-chip";
import { Timeline } from "@/components/cases/timeline";
import { WarrantyPanel } from "@/components/cases/warranty-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { RelayStrip, type Station } from "@/components/shared/relay-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCaseAccess } from "@/lib/auth/access";
import { requireActor } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/cases/categories";
import { chatChannelsFor } from "@/lib/cases/chat-channels";
import { availableActions, ownerKindFor } from "@/lib/cases/state-machine";
import { getCaseView, type CaseView } from "@/lib/db/queries/case-view";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Case" };

/** Transitions driven from other screens (dispatch centre, technician app, customer portal, handoff). */
const ELSEWHERE = new Set(["send_to_dispatch", "assign_technician", "schedule", "unassign", "start_work", "complete_work", "confirm_resolution", "reject_resolution"]);
const NEEDS_REASON = new Set(["request_info", "reject", "escalate", "cancel", "unassign", "reject_resolution", "propose_desk_resolution"]);
const PRIMARY = new Set(["start_triage", "review_warranty", "close", "retriage", "redispatch", "deescalate_triage", "deescalate_dispatch", "info_provided"]);
const DANGER = new Set(["reject", "cancel"]);

export default function StaffCasePage({ params }: PageProps<"/dashboard/cases/[caseId]">) {
  return (
    <Suspense fallback={<CaseSkeleton />}>
      {params.then(({ caseId }) => (
        <StaffCase caseId={caseId} />
      ))}
    </Suspense>
  );
}

async function StaffCase({ caseId }: { caseId: string }) {
  const actor = await requireActor();
  const access = await resolveCaseAccess(actor, caseId);
  if (!access || access.role === "customer") notFound();
  const view = await getCaseView(actor.authUserId, caseId);
  if (!view) notFound();

  const c = view.case;
  const role = access.role;
  const actions: CaseAction[] = availableActions(c.status, role)
    .filter((a) => !ELSEWHERE.has(a.action))
    .map((a) => ({ ...a, needsReason: NEEDS_REASON.has(a.action), tone: PRIMARY.has(a.action) ? "primary" : DANGER.has(a.action) ? "danger" : undefined }));
  const { channels, names } = chatChannelsFor(view, role, actor.user.id);
  const kind = ownerKindFor(c.status);
  const station: Station | null = kind === "agent" ? "agent" : kind;
  const ownerName = c.currentOwnerId ? (view.participants.find((p) => p.userId === c.currentOwnerId)?.name ?? view.agent?.name) : null;
  const latestHandoff = view.handoffs[0];
  const staffEditor = role === "owner" || role === "support_agent";
  const open = !["closed", "cancelled", "rejected"].includes(c.status);

  return (
    <div className="space-y-6">
      <LiveRefresh table="service_cases" />
      <header className="space-y-4">
        <Link href="/dashboard/cases" className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground">
          Service cases
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-tag text-sm text-muted-foreground">{c.caseNumber}</p>
            <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={c.status} />
              <PriorityMark priority={c.priority} />
              <span className="text-sm text-muted-foreground">opened {date(c.createdAt)}</span>
            </div>
          </div>
          <p className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
            <span aria-hidden className={`size-2.5 rounded-full ${ownerName ? "bg-baton" : "bg-border"}`} />
            {ownerName ? (
              <span>
                With <span className="font-semibold">{ownerName}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{kind === "dispatcher" ? "In the dispatch queue" : "No current owner"}</span>
            )}
          </p>
        </div>
        <RelayStrip
          current={station}
          className="max-w-2xl"
          labels={{ customer: view.customer.name, agent: view.agent?.name ?? "Support", technician: view.technician?.name ?? "Technician" }}
        />
      </header>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="space-y-6">
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <CaseActions caseId={c.id} status={c.status} actions={actions} />
            {staffEditor && c.status === "warranty_review" && (
              <HandoffBuilder
                caseId={c.id}
                caseNumber={c.caseNumber}
                customerTried={c.troubleshooting}
                attachments={view.attachments.map((a) => ({ id: a.id, fileName: a.fileName }))}
                warrantyReady={c.warrantyStatus === "eligible" || c.warrantyStatus === "exception"}
              />
            )}
          </section>
          <Facts view={view} />
          <section className="rounded-lg border bg-card p-4">
            <WarrantyPanel
              caseId={c.id}
              canEdit={staffEditor && open}
              info={{
                status: c.warrantyStatus,
                notes: view.warranty?.notes ?? null,
                verifiedBy: view.warranty?.verifiedById ? (view.people[view.warranty.verifiedById]?.name ?? null) : null,
                policyName: view.warranty?.policyName ?? null,
                coverageNotes: view.warranty?.coverageNotes ?? null,
                startsAt: view.warranty?.startsAt ?? null,
                expiresAt: view.warranty?.expiresAt ?? null,
                daysLeft: view.warranty?.expiresAt ? Math.floor((new Date(view.warranty.expiresAt).getTime() - Date.now()) / 86_400_000) : null,
              }}
            />
          </section>
        </aside>

        <div className="min-w-0 space-y-8">
          <section className="space-y-2 rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Original complaint</h2>
            <p className="text-sm text-muted-foreground">{categoryLabel(c.category)}</p>
            <p className="whitespace-pre-line">{c.description}</p>
            {c.troubleshooting.length > 0 && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">Customer already tried</p>
                <ul className="list-disc pl-5">
                  {c.troubleshooting.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {latestHandoff && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Handoff</h2>
              <HandoffCard snapshot={latestHandoff.contextSnapshot} />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Timeline</h2>
            <Timeline view={view} />
          </section>

          <EvidenceGrid view={view} canAdd={open} />
        </div>

        <ChatPanel channels={channels} names={names} locale={actor.user.locale} className="h-[32rem] xl:sticky xl:top-20 xl:h-[calc(100dvh-7rem)]" />
      </div>
    </div>
  );
}

function Facts({ view }: { view: CaseView }) {
  const a = view.case.serviceAddress;
  return (
    <section className="divide-y rounded-lg border bg-card text-sm">
      <Fact label="Customer">
        <p className="font-medium">{view.customer.name}</p>
        <p className="text-muted-foreground">{view.customer.email}</p>
        {view.customer.phone && (
          <a href={`tel:${view.customer.phone.replace(/\s/g, "")}`} className="font-tag text-primary underline-offset-4 hover:underline">
            {view.customer.phone}
          </a>
        )}
        {a && <p className="text-muted-foreground">{[a.line1, a.city, a.postcode].filter(Boolean).join(", ")}</p>}
      </Fact>
      <Fact label="Order">
        <p className="font-tag">#{view.order.orderNumber}</p>
        <p className="text-muted-foreground">
          {date(view.order.orderedAt)}, {money(view.order.total, view.order.currency)}
        </p>
      </Fact>
      <Fact label="Product">
        <p>{view.item.name}</p>
        {view.item.sku && <p className="font-tag text-muted-foreground">SKU {view.item.sku}</p>}
        <p className="font-tag text-muted-foreground">Serial {view.case.reportedSerial ?? view.item.serialNumber ?? "not given"}</p>
        {view.case.reportedSerial && view.item.serialNumber && view.case.reportedSerial !== view.item.serialNumber && (
          <p className="text-warning">Customer&apos;s serial differs from the store record ({view.item.serialNumber}).</p>
        )}
      </Fact>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
