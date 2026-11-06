import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The editorial illustration set (ink line art, flat amber and graphite fills). Shown as rounded
 * panels (radius passed in, so it nests correctly) on their own paper colour. Lazy-loaded
 * unless `priority` (above-the-fold hero only).
 */
const ART = {
  hero: { w: 1536, h: 1024, alt: "A woman sits beside her leaking washing machine, calmly messaging support on her phone" },
  support: { w: 1448, h: 1086, alt: "A support agent with a headset smiles as she reads a message on her laptop" },
  dispatch: { w: 1448, h: 1086, alt: "A dispatcher hands a tablet with the job to a technician" },
  technician: { w: 1448, h: 1086, alt: "A technician kneels at a washing machine, inspecting the door seal, toolbox open beside him" },
  resolved: { w: 1448, h: 1086, alt: "The customer smiles at her phone as the technician packs up his toolbox" },
  "caught-up": { w: 1254, h: 1254, alt: "Someone leans back at a tidy desk with a cup of tea" },
} as const;
export type IllustrationName = keyof typeof ART;

export function Illustration({
  name,
  className,
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  decorative = false,
}: {
  name: IllustrationName;
  className?: string;
  priority?: boolean;
  sizes?: string;
  decorative?: boolean;
}) {
  const a = ART[name];
  return (
    <div className={cn("overflow-hidden border bg-[#f7f2ed]", className)}>
      <Image
        src={`/illustrations/${name}.webp`}
        width={a.w}
        height={a.h}
        alt={decorative ? "" : a.alt}
        priority={priority}
        sizes={sizes}
        className="h-auto w-full"
      />
    </div>
  );
}
