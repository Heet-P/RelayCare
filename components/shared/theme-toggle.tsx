"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "@/components/ui/skiper-ui/skiper26";
import { cn } from "@/lib/utils";

/**
 * Quiet icon button on Skiper26's theme hook (keeps its View Transitions circle reveal).
 * Both icons render and CSS picks one, so server and client markup always match.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { toggleTheme } = useThemeToggle({ variant: "circle", start: "top-right" });
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Switch light or dark"
      className={cn(
        "pressable relative grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Moon className="size-[18px] transition-[opacity,transform] duration-200 ease-[var(--ease-out)] dark:scale-75 dark:opacity-0" />
      <Sun className="absolute size-[18px] scale-75 opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] dark:scale-100 dark:opacity-100" />
    </button>
  );
}
