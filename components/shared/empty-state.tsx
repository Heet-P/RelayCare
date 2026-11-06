import { CheckCheck, Inbox, MessagesSquare, ShoppingBag, Wrench } from "lucide-react";
import Link from "next/link";
import { IconTile } from "@/components/shared/icon-tile";
import { Illustration, type IllustrationName } from "@/components/shared/illustration";

const ART = { cases: Inbox, jobs: Wrench, orders: ShoppingBag, done: CheckCheck, chat: MessagesSquare } as const;
/** Moments that get a full illustration instead of an icon (a calm queue, a technician's day). */
const SCENE: Partial<Record<keyof typeof ART, IllustrationName>> = { done: "caught-up", jobs: "technician" };

/** An empty screen is an invitation to act: what's missing, and the next step. */
export function EmptyState({
  art,
  title,
  body,
  action,
}: {
  art: keyof typeof ART;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="panel rise flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center">
      {SCENE[art] ? (
        <Illustration name={SCENE[art]} decorative className="mb-2 w-full max-w-xs rounded-xl" sizes="320px" />
      ) : (
        <IconTile icon={ART[art]} className="mb-2" />
      )}
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      {body && <p className="max-w-sm text-muted-foreground text-balance">{body}</p>}
      {action && (
        <Link href={action.href} className="pressable mt-1 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          {action.label}
        </Link>
      )}
    </div>
  );
}
