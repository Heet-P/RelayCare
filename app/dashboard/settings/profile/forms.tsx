"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setChatLanguage } from "@/lib/nexconn/client";
import { changePassword, updateProfile, type ProfileState } from "@/lib/profile";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "gu", label: "ગુજરાતી (Gujarati)" },
];

export function ProfileForm({ name, phone, locale, email }: { name: string; phone: string; locale: string; email: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ProfileState, FormData>(async (prev, form) => {
    const result = await updateProfile(prev, form);
    if (result.ok) await setChatLanguage(String(form.get("locale")));
    return result;
  }, {});
  useEffect(() => {
    if (state.ok) {
      toast.success("Profile saved");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Your profile</h2>
      <p className="text-sm text-muted-foreground">Signed in as {email}</p>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locale">Chat language</Label>
        <select id="locale" name="locale" defaultValue={locale} className="h-11 w-full rounded-md border border-input bg-background px-3">
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">Messages from customers and colleagues are translated into this language.</p>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<ProfileState, FormData>(changePassword, {});
  useEffect(() => {
    if (state.ok) toast.success("Password changed");
  }, [state]);
  return (
    <form action={action} className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Password</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Repeat it</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11" />
        </div>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" variant="outline" className="h-11" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
