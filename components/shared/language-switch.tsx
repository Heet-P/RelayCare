"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setChatLanguage } from "@/lib/nexconn/client";
import { setLocale } from "@/lib/profile";

const OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "gu", label: "ગુજરાતી" },
];

/** Switches screen language and chat translation together. */
export function LanguageSwitch({ locale }: { locale: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="relative flex h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent">
      <Languages className="size-4" aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            await setLocale(next);
            await setChatLanguage(next);
            router.refresh();
          });
        }}
        className="h-11 cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
