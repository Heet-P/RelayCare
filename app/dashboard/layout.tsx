import { Suspense } from "react";
import { DashboardNav, StoreMark } from "@/components/dashboard/nav";
import { StaffGuard } from "@/components/dashboard/staff-guard";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggleButton } from "@/components/ui/skiper-ui/skiper26";

/**
 * Staff workspace shell. Navigation is static (prerendered); anything that reads the session
 * streams in behind <Suspense>. Every page and API route still authorizes on its own.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden flex-col gap-8 border-r bg-sidebar px-4 py-6 lg:flex">
        <div className="space-y-1 px-3">
          <p className="text-lg font-semibold tracking-tight">RelayCare</p>
          <StoreMark />
        </div>
        <DashboardNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/90 px-4 backdrop-blur sm:px-8">
          <MobileNav />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggleButton className="size-11 bg-foreground" start="top-right" />
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Suspense fallback={null}>
            <StaffGuard />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
