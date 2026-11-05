import { SettingsNav } from "@/components/dashboard/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <SettingsNav />
      </div>
      {children}
    </div>
  );
}
