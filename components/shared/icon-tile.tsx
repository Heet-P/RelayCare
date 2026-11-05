import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A soft, lit tile holding one icon (Apple-style app-icon depth: top highlight, warm falloff,
 * long quiet shadow). Used for empty states and feature rows instead of drawings.
 */
export function IconTile({ icon: Icon, className, size = "md" }: { icon: LucideIcon; className?: string; size?: "md" | "sm" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid place-items-center border bg-[linear-gradient(180deg,var(--card),var(--secondary))] text-foreground",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(28_25_23/0.06),0_12px_24px_-12px_rgb(28_25_23/0.25)]",
        size === "md" ? "size-16 rounded-[20px]" : "size-12 rounded-[16px]",
        className,
      )}
    >
      <Icon className={size === "md" ? "size-7" : "size-5"} strokeWidth={1.75} />
    </span>
  );
}
