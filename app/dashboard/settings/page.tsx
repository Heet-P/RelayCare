import { redirect } from "next/navigation";

// Settings opens on the section every role can use.
export default function SettingsPage() {
  redirect("/dashboard/settings/profile");
}
