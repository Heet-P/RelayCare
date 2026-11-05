import { Suspense } from "react";
import { DashboardNav, StoreMark } from "@/components/dashboard/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { StaffGuard } from "@/components/dashboard/staff-guard";
import { Logo } from "@/components/shared/logo";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggleButton } from "@/components/ui/skiper-ui/skiper26";

/**
 * Staff workspace. Chrome floats on glass over the warm wash (sidebar, top bar); content
 * stays on solid panels. Navigation is static (prerendered); session-dependent parts stream in.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="min-h-dvh lg:pl-[280px]">
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-[256px] flex-col gap-8 rounded-2xl px-3 py-5 lg:flex">
        <div className="space-y-1 px-3">
          <Logo href="/dashboard" />
          <StoreMark />
        </div>
        <DashboardNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="glass sticky top-3 z-20 mx-3 mt-3 flex h-16 items-center gap-3 rounded-2xl px-3 sm:px-4 lg:ml-0">
          <MobileNav />
          <div className="lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggleButton className="size-11 bg-foreground" start="top-right" />
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:pr-6 lg:pl-3">
          <Suspense fallback={null}>
            <StaffGuard />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
