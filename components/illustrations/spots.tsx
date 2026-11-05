import { cn } from "@/lib/utils";

/*
 * Spot illustrations and empty states. One style everywhere: 2.5px rounded ink outlines, flat
 * fills from the --ill-* palette, a soft ground shadow. Decorative unless given a label.
 */
const ink = "var(--ill-ink)";
const S = { stroke: ink, strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Frame({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 120" className={cn("h-auto w-40", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <ellipse cx="80" cy="108" rx="58" ry="7" fill="var(--ill-shade)" />
      {children}
    </svg>
  );
}

/** Two people passing the marigold baton: the structured handoff. */
export function SpotHandoff(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      {/* left sleeve + hand */}
      <path d="M8 86 l 30 -26 l 14 14 l -26 28 z" fill="var(--ill-peacock)" {...S} />
      <rect x="40" y="52" width="24" height="20" rx="10" fill="var(--ill-terracotta)" fillOpacity="0.45" {...S} transform="rotate(-38 52 62)" />
      {/* right sleeve + hand */}
      <path d="M152 74 l -30 -22 l -12 14 l 28 24 z" fill="var(--ill-neck)" {...S} />
      <rect x="96" y="44" width="24" height="20" rx="10" fill="var(--ill-terracotta)" fillOpacity="0.7" {...S} transform="rotate(36 108 54)" />
      {/* baton */}
      <rect x="58" y="46" width="46" height="15" rx="7.5" fill="var(--ill-marigold)" {...S} transform="rotate(-8 81 53)" />
    </Frame>
  );
}

/** Shield with a check: warranty verified by a person. */
export function SpotWarranty(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      <path d="M80 14 l 34 12 v 26 c 0 24 -16 40 -34 48 c -18 -8 -34 -24 -34 -48 v -26 z" fill="var(--ill-paper)" {...S} />
      <path d="M80 24 l 24 9 v 19 c 0 17 -11 29 -24 35 z" fill="var(--ill-peacock)" opacity="0.9" />
      <path d="M66 58 l 10 10 l 20 -22" fill="none" {...S} strokeWidth={4} stroke="var(--ill-marigold)" />
    </Frame>
  );
}

/** Gujarati and English bubbles: automatic translation. */
export function SpotTranslate(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      <rect x="18" y="20" width="70" height="44" rx="16" fill="var(--ill-paper)" {...S} />
      <path d="M34 64 l -6 12 l 16 -12" fill="var(--ill-paper)" {...S} />
      <text x="40" y="51" fontSize="24" fill={ink} fontFamily="var(--font-hind-vadodara), sans-serif">અ</text>
      <rect x="72" y="46" width="70" height="44" rx="16" fill="var(--ill-peacock)" {...S} />
      <path d="M126 90 l 6 12 l -16 -12" fill="var(--ill-peacock)" {...S} />
      <text x="97" y="77" fontSize="22" fontWeight="700" fill="var(--ill-paper)" fontFamily="var(--font-instrument), sans-serif">A</text>
    </Frame>
  );
}

/** Clipboard and plant: no cases yet. */
export function EmptyCases(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      <rect x="44" y="18" width="62" height="82" rx="12" fill="var(--ill-paper)" {...S} />
      <rect x="62" y="12" width="26" height="14" rx="7" fill="var(--ill-peacock)" {...S} />
      <path d="M58 46 h 34 M58 60 h 34 M58 74 h 20" {...S} opacity="0.45" />
      <path d="M118 100 v -26" {...S} stroke="var(--ill-leaf)" />
      <path d="M118 84 q -14 -4 -14 -16 q 12 2 14 16 z M118 78 q 12 -4 14 -16 q -14 2 -14 16 z" fill="var(--ill-leaf)" {...S} />
    </Frame>
  );
}

/** Toolbox and spanner: no jobs yet. */
export function EmptyJobs(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      <rect x="32" y="52" width="96" height="50" rx="12" fill="var(--ill-terracotta)" {...S} />
      <path d="M62 52 v -12 h 36 v 12" fill="none" {...S} />
      <rect x="32" y="68" width="96" height="7" fill={ink} opacity="0.15" />
      <path d="M112 22 l -26 26" {...S} strokeWidth={6} stroke="var(--ill-peacock)" />
      <circle cx="116" cy="18" r="9" fill="none" {...S} />
    </Frame>
  );
}

/** Shopping bag with a parcel: no purchases found. */
export function EmptyOrders(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      <path d="M42 40 h 76 l -6 62 h -64 z" fill="var(--ill-peacock)" {...S} />
      <path d="M62 40 v -8 a 18 18 0 0 1 36 0 v 8" fill="none" {...S} />
      <rect x="92" y="64" width="38" height="34" rx="6" fill="var(--ill-marigold)" {...S} />
      <path d="M111 64 v 34" {...S} opacity="0.5" />
    </Frame>
  );
}

/** Marigold sun with a check: nothing waiting, all caught up. */
export function AllCaughtUp(p: { className?: string; label?: string }) {
  return (
    <Frame {...p}>
      <g transform="translate(80 54)">
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-30" rx="7" ry="13" fill="var(--ill-marigold)" {...S} strokeWidth={2} transform={`rotate(${i * 30})`} />
        ))}
        <circle r="22" fill="var(--ill-terracotta)" {...S} />
        <path d="M-9 0 l 6 6 l 12 -13" fill="none" {...S} stroke="var(--ill-paper)" strokeWidth={4} />
      </g>
    </Frame>
  );
}
