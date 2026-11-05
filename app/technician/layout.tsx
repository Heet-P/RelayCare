import Link from "next/link";
import { Suspense } from "react";
import { TechnicianGuard } from "@/components/technician/technician-guard";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggleButton } from "@/components/ui/skiper-ui/skiper26";

/** Technician workspace: phone-first, one job at a time. */
export default function TechnicianLayout({ children }: LayoutProps<"/technician">) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-4">
          <Link href="/technician/jobs" className="mr-auto leading-tight">
            <span className="block font-semibold tracking-tight">Your jobs</span>
            <span className="block text-xs text-muted-foreground">Demo Electronics Service Team</span>
          </Link>
          <ThemeToggleButton className="size-11 bg-foreground" start="top-right" />
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Suspense fallback={null}>
          <TechnicianGuard />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
