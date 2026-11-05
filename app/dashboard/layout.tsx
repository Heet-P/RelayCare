import { Suspense } from "react";
import { DashboardNav, StoreMark } from "@/components/dashboard/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { StaffGuard } from "@/components/dashboard/staff-guard";
import { Logo } from "@/components/shared/logo";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Staff workspace. On desktop everything that is chrome lives in the floating glass sidebar
 * (person and theme at its foot), so pages start at the top with no empty bar. Phones get a
 * compact glass top bar with the menu. Session-dependent parts stream in.
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
        <div className="mt-auto flex items-center gap-1 border-t pt-4 pl-2">
          <div className="min-w-0 flex-1">
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="glass sticky top-3 z-20 mx-3 mt-3 flex h-16 items-center gap-2 rounded-2xl px-3 sm:px-4 lg:hidden">
          <MobileNav />
          <Logo href="/dashboard" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:pt-10 lg:pr-6 lg:pl-3">
          <Suspense fallback={null}>
            <StaffGuard />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
