"use client";

import { Copy } from "lucide-react";
import { useActionState, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMember, updateMember, type InviteState } from "./actions";

type Role = "owner" | "support_agent" | "dispatcher" | "technician";
const ROLES: { value: Role; label: string }[] = [
  { value: "support_agent", label: "Support agent" },
  { value: "dispatcher", label: "Dispatcher" },
  { value: "technician", label: "Technician" },
  { value: "owner", label: "Store owner" },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

type Member = { userId: string; name: string; email: string; role: Role; isActive: boolean; signedUp: boolean };

/** Optimistic role/access changes; rolled back with a toast if the server refuses. */
export function MemberRow({ member, editable }: { member: Member; editable: boolean }) {
  const [shown, setShown] = useOptimistic(member);
  const [, start] = useTransition();
  const change = (patch: Partial<Pick<Member, "role" | "isActive">>) =>
    start(async () => {
      setShown({ ...shown, ...patch });
      const res = await updateMember(member.userId, patch);
      if (res.error) toast.error(res.error);
      else toast.success("Team updated");
    });

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={shown.isActive ? "font-medium" : "font-medium text-muted-foreground line-through"}>{member.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {member.email}
          {!member.signedUp && " (invited, hasn't signed in yet)"}
        </p>
      </div>
      {editable ? (
        <>
          <select
            aria-label={`Role for ${member.name}`}
            value={shown.role}
            onChange={(e) => change({ role: e.target.value as Role })}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button variant="outline" className="h-11" onClick={() => change({ isActive: !shown.isActive })}>
            {shown.isActive ? "Remove access" : "Restore access"}
          </Button>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{roleLabel(member.role)}</span>
      )}
    </li>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(async (prev, form) => {
    const res = await inviteMember(prev, form);
    if (res.ok) toast.success(res.emailed ? "Invitation sent" : "Member added. Share their sign-in link.");
    return res;
  }, {});

  return (
    <section className="space-y-4 panel rounded-xl p-6">
      <h2 className="text-lg font-semibold">Add a team member</h2>
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input id="invite-name" name="name" required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Role</Label>
          <select id="invite-role" name="role" defaultValue="support_agent" className="h-11 w-full rounded-md border border-input bg-background px-3">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? "Adding…" : "Send invitation"}
          </Button>
        </div>
      </form>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.link && (
        <div className="space-y-2 rounded-md bg-warning/10 p-3 text-sm">
          <p>The email couldn&apos;t be sent (check the Resend sending domain). Share this one-time sign-in link instead:</p>
          <div className="flex items-center gap-2">
            <code className="font-tag min-w-0 flex-1 break-all">{state.link}</code>
            <button
              type="button"
              aria-label="Copy sign-in link"
              className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-accent"
              onClick={() => navigator.clipboard.writeText(state.link!).then(() => toast.success("Link copied"))}
            >
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
