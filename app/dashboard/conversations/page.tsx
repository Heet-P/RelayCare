import { MessagesSquare, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusChip } from "@/components/cases/status-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgRole } from "@/lib/auth/access";
import { age } from "@/lib/cases/labels";
import { listConversations } from "@/lib/db/queries/staff";

export const metadata: Metadata = { title: "Conversations" };

export default function ConversationsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">Every case chat you can open. Messages stay with the case, so context is never lost.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <Threads />
      </Suspense>
    </div>
  );
}

async function Threads() {
  const { actor } = await requireOrgRole(["owner", "support_agent", "dispatcher"]);
  const threads = await listConversations(actor.authUserId);
  if (!threads.length) return <p className="panel rounded-xl p-6 text-muted-foreground">No conversations yet. A chat opens when a customer reports a problem.</p>;
  return (
    <ul className="divide-y panel rounded-xl">
      {threads.map((t) => {
        const Icon = t.threadType === "group" ? Users : MessagesSquare;
        return (
          <li key={t.threadId}>
            <Link href={`/dashboard/cases/${t.caseId}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40">
              <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {t.threadType === "group" ? "Service team" : "Support chat"} with {t.customerName}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  <span className="font-tag">{t.caseNumber}</span>, {t.productName}
                </span>
              </span>
              <StatusChip status={t.status} />
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {t.lastMessageAt ? `active ${age(t.lastMessageAt)} ago` : `opened ${age(t.openedAt)} ago`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
