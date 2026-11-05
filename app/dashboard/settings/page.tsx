import { redirect } from "next/navigation";

// ponytail: Integrations is the only settings section until Phase 4 adds members, warranty rules and profile.
export default function SettingsPage() {
  redirect("/dashboard/settings/integrations");
}
