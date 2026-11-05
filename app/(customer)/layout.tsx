import { Suspense } from "react";
import { CustomerGuard } from "@/components/customer/customer-guard";
import { LocalizedTabs } from "@/components/customer/localized-tabs";
import { CustomerTabs } from "@/components/customer/tabs";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggleButton } from "@/components/ui/skiper-ui/skiper26";

/** Customer portal: phone-first single column, bottom tabs on small screens. */
export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-4">
          <div className="mr-auto leading-tight">
            <p className="font-semibold tracking-tight">Demo Electronics</p>
            <p className="text-xs text-muted-foreground">Support by RelayCare</p>
          </div>
          <div className="hidden sm:block">
            <Suspense fallback={<CustomerTabs />}>
              <LocalizedTabs />
            </Suspense>
          </div>
          <ThemeToggleButton className="size-11 bg-foreground" start="top-right" />
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Suspense fallback={null}>
          <CustomerGuard />
        </Suspense>
        {children}
      </main>
      <div className="sm:hidden">
        <Suspense fallback={<CustomerTabs />}>
          <LocalizedTabs />
        </Suspense>
      </div>
    </div>
  );
}
