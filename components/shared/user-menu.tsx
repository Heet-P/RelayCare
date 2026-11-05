import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { getActor } from "@/lib/auth/session";

const ROLE_LABEL = { owner: "Store owner", support_agent: "Support agent", dispatcher: "Dispatcher", technician: "Technician" } as const;

/** Signed-in person + sign out. Reads the session, so render it inside <Suspense>. */
export async function UserMenu() {
  const actor = await getActor();
  if (!actor) return null;
  const role = actor.memberships[0]?.role;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold"
      >
        {actor.user.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-sm font-medium">{actor.user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{role ? ROLE_LABEL[role] : "Customer"}</span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export const UserMenuSkeleton = () => (
  <div className="flex items-center gap-3" aria-hidden>
    <span className="size-9 animate-pulse rounded-full bg-muted" />
    <span className="hidden h-8 w-24 animate-pulse rounded bg-muted sm:block" />
  </div>
);
