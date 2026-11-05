import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActor } from "@/lib/auth/session";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-xl rounded-lg" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const actor = await requireActor();
  return (
    <div className="max-w-xl space-y-8">
      <ProfileForm name={actor.user.name} phone={actor.user.phone ?? ""} locale={actor.user.locale} email={actor.user.email} />
      <PasswordForm />
    </div>
  );
}
