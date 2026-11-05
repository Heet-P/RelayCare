import { Suspense } from "react";
import { CustomerGuard } from "@/components/customer/customer-guard";
import { Logo } from "@/components/shared/logo";
import { LocalizedTabs } from "@/components/customer/localized-tabs";
import { CustomerTabs } from "@/components/customer/tabs";
import { MyLanguage } from "@/components/shared/my-language";
import { UserMenu, UserMenuSkeleton } from "@/components/shared/user-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Customer portal: phone-first single column with bottom tabs; on desktop a one-line top bar
 * and a wider canvas (pages decide whether they use two columns or stay at reading width).
 */
export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh pb-28 sm:pb-0">
      <header className="glass sticky top-3 z-20 mx-3 mt-3 rounded-2xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-3 lg:max-w-5xl">
          <Logo href="/my-orders" className="mr-auto sm:mr-4" sub="Demo Electronics" />
          <div className="hidden sm:mr-auto sm:block">
            <Suspense fallback={<CustomerTabs />}>
              <LocalizedTabs />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <MyLanguage />
          </Suspense>
          <ThemeToggle />
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 lg:max-w-5xl lg:py-10">
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
