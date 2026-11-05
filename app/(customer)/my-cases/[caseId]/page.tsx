import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EvidenceGrid } from "@/components/cases/evidence";
import { InfoRequest } from "@/components/customer/info-request";
import { RateService, ResolutionReview, type RepairReport } from "@/components/customer/resolution-review";
import { ChatPanel } from "@/components/chat/chat-panel";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCaseAccess } from "@/lib/auth/access";
import { requireActor } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/cases/categories";
import { chatChannelsFor } from "@/lib/cases/chat-channels";
import { customerStatusIn } from "@/lib/cases/customer-status";
import { tr } from "@/lib/i18n";
import { getCaseView } from "@/lib/db/queries/case-view";
import { date } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your case" };

export default function CustomerCasePage({ params }: PageProps<"/my-cases/[caseId]">) {
  return (
    <div className="space-y-6">
      <Link href="/my-cases" className="inline-flex h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        All cases
      </Link>
      <Suspense fallback={<CaseSkeleton />}>{params.then(({ caseId }) => <CustomerCase caseId={caseId} />)}</Suspense>
    </div>
  );
}

async function CustomerCase({ caseId }: { caseId: string }) {
  const actor = await requireActor();
  const access = await resolveCaseAccess(actor, caseId);
  if (!access) notFound();
  const view = await getCaseView(actor.authUserId, caseId);
  if (!view) notFound();

  const c = view.case;
  const t = tr(actor.user.locale);
  const status = customerStatusIn(actor.user.locale, c.status, {
    agent: view.agent?.name,
    technician: view.technician?.name,
    visitAt: view.activeAssignment?.scheduledAt ?? null,
  });
  const { channels, names } = chatChannelsFor(view, access.role, actor.user.id);
  const open = !["closed", "cancelled", "rejected"].includes(c.status);

  return (
    <div className="space-y-8">
      <LiveRefresh table="service_cases" />
      <header className="space-y-2">
        <p className="font-tag text-sm text-muted-foreground">
          {c.caseNumber}, {t.opened} {date(c.createdAt)}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{view.item.name}</h1>
        <p className="text-muted-foreground">{categoryLabel(c.category)}</p>
      </header>

      <section className="space-y-4 panel rounded-xl p-4" aria-label="Progress">
        <ol className="grid grid-cols-5 gap-1">
          {t.steps.map((s, i) => (
            <li key={s} className="space-y-2" aria-current={i === status.step ? "step" : undefined}>
              <span
                className={cn(
                  "block h-1.5 rounded-full",
                  i < status.step ? "bg-foreground/50" : i === status.step ? "bg-amber" : "bg-border",
                )}
              />
              <span className={cn("block text-xs text-muted-foreground", i === status.step && "font-semibold text-foreground")}>{s}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-1">
          <p className="text-lg font-semibold">{status.headline}</p>
          <p className="text-muted-foreground">{status.next}</p>
        </div>
        {view.technician && (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm">
            {t.technician}: <span className="font-medium">{view.technician.name}</span>
            {view.activeAssignment?.scheduledAt && <>, {t.visit} {date(view.activeAssignment.scheduledAt)}</>}
          </p>
        )}
      </section>

      {c.status === "resolution_pending" && (
        <ResolutionReview
          t={t}
          caseId={c.id}
          technician={view.people[view.assignments.find((a) => a.assignmentStatus === "completed")?.technicianId ?? ""]?.name ?? null}
          report={(view.assignments.find((a) => a.assignmentStatus === "completed")?.report as RepairReport | null) ?? null}
          deskNotes={c.resolutionNotes}
        />
      )}
      {(c.status === "resolved" || c.status === "closed") && <RateService t={t} caseId={c.id} existing={c.csatScore} />}

      {c.status === "awaiting_customer" && (
        <InfoRequest
          t={t}
          caseId={c.id}
          agent={view.agent?.name ?? "Support"}
          question={
            ([...view.events].reverse().find((e) => e.newStatus === "awaiting_customer")?.metadata as { reason?: string } | undefined)?.reason ?? null
          }
        />
      )}

      <ChatPanel channels={channels} names={names} locale={actor.user.locale} className="h-[28rem]" />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.yourReport}</h2>
        <dl className="divide-y panel rounded-xl">
          <div className="space-y-1 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{t.whatHappened}</dt>
            <dd className="whitespace-pre-line">{c.description}</dd>
          </div>
          {c.troubleshooting.length > 0 && (
            <div className="space-y-1 px-4 py-3">
              <dt className="text-sm text-muted-foreground">{t.alreadyTried}</dt>
              <dd>
                <ul className="list-disc pl-5">
                  {c.troubleshooting.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 px-4 py-3">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">{t.order}</dt>
              <dd className="font-tag">#{view.order.orderNumber}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">{t.serial}</dt>
              <dd className="font-tag">{c.reportedSerial ?? t.notGiven}</dd>
            </div>
          </div>
        </dl>
      </section>

      <EvidenceGrid view={view} canAdd={open} labels={{ title: t.photos, add: t.addPhotos }} />
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div className="space-y-8" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-[28rem] w-full rounded-lg" />
    </div>
  );
}
