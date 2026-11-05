import { Suspense } from "react";
import { Logo } from "@/components/shared/logo";
import { TechnicianGuard } from "@/components/technician/technician-guard";
import { MyLanguage } from "@/components/shared/my-language";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggleButton } from "@/components/ui/skiper-ui/skiper26";

/** Technician workspace: phone-first, one job at a time. */
export default function TechnicianLayout({ children }: LayoutProps<"/technician">) {
  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-3 z-20 mx-3 mt-3 rounded-2xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-3">
          <Logo href="/technician/jobs" className="mr-auto" sub="Service team" />
          <Suspense fallback={null}>
            <MyLanguage />
          </Suspense>
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
