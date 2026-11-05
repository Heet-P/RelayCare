import Link from "next/link";
import { getActor } from "@/lib/auth/session";

/** "Open your workspace" when signed in, "Sign in" otherwise (reads the session: render in Suspense). */
export async function WorkspaceLink() {
  const actor = await getActor();
  return (
    <Link href={actor ? "/workspace" : "/login"} className="pressable inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
      {actor ? "Open your workspace" : "Sign in"}
    </Link>
  );
}
