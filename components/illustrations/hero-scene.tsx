import { cn } from "@/lib/utils";

/**
 * The RelayCare story in one picture: a leaking washing machine, the customer's phone (Gujarati
 * chat), the support headset and the technician, joined by a dotted relay path with the
 * marigold baton travelling along it. Colours come from --ill-* tokens (light and dark).
 * `animate` sends the baton along the path once (skipped for reduced motion).
 */
export function HeroScene({ className, animate = false }: { className?: string; animate?: boolean }) {
  const ink = "var(--ill-ink)";
  return (
    <svg viewBox="0 0 640 420" className={cn("h-auto w-full", className)} role="img" aria-label="A customer reports a leaking washing machine; support and a technician pick it up along one connected path">
      <defs>
        <linearGradient id="hs-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--ill-neck)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--ill-peacock)" stopOpacity="0.85" />
        </linearGradient>
        <path id="hs-relay" d="M150 150 C 230 40, 360 40, 420 120 S 540 200, 560 140" />
      </defs>

      {/* ground */}
      <ellipse cx="320" cy="378" rx="290" ry="26" fill="var(--ill-shade)" />

      {/* relay path + baton */}
      <use href="#hs-relay" fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      <g>
        <rect x="-16" y="-7" width="32" height="14" rx="7" fill="var(--ill-marigold)" stroke={ink} strokeWidth="2.5" />
        {animate ? (
          <animateMotion dur="3.2s" begin="0.4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.6 0 0.2 1" rotate="auto">
            <mpath href="#hs-relay" />
          </animateMotion>
        ) : (
          <animateMotion dur="0.001s" fill="freeze" keyPoints="1;1" keyTimes="0;1" rotate="auto">
            <mpath href="#hs-relay" />
          </animateMotion>
        )}
      </g>

      {/* washing machine */}
      <g transform="translate(70 170)">
        <rect x="0" y="0" width="150" height="190" rx="22" fill="var(--ill-paper)" stroke={ink} strokeWidth="2.5" />
        <rect x="0" y="0" width="150" height="40" rx="22" fill="var(--ill-shade)" stroke={ink} strokeWidth="2.5" />
        <circle cx="30" cy="20" r="7" fill="var(--ill-terracotta)" stroke={ink} strokeWidth="2.5" />
        <rect x="52" y="14" width="44" height="12" rx="6" fill="var(--ill-paper)" stroke={ink} strokeWidth="2.5" />
        <circle cx="75" cy="112" r="52" fill="var(--ill-shade)" stroke={ink} strokeWidth="2.5" />
        <circle cx="75" cy="112" r="38" fill="url(#hs-water)" stroke={ink} strokeWidth="2.5" />
        <path d="M45 112 q 15 -12 30 0 t 30 0" fill="none" stroke="var(--ill-paper)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        {/* the leak */}
        <path d="M118 190 q 4 14 -2 22 q -8 -6 2 -22 z" fill="var(--ill-neck)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="140" cy="214" rx="26" ry="6" fill="var(--ill-neck)" opacity="0.35" />
      </g>

      {/* customer phone with Gujarati chat */}
      <g transform="translate(110 70) rotate(-8)">
        <rect x="0" y="0" width="84" height="132" rx="18" fill="var(--ill-paper)" stroke={ink} strokeWidth="2.5" />
        <rect x="30" y="8" width="24" height="5" rx="2.5" fill={ink} opacity="0.5" />
        <rect x="10" y="26" width="56" height="26" rx="10" fill="var(--ill-shade)" stroke={ink} strokeWidth="2" />
        <text x="18" y="44" fontSize="13" fill={ink} fontFamily="var(--font-hind-vadodara), sans-serif">પાણી લીક</text>
        <rect x="22" y="60" width="52" height="22" rx="10" fill="var(--ill-peacock)" />
        <rect x="30" y="69" width="34" height="4" rx="2" fill="var(--ill-paper)" />
        <rect x="10" y="90" width="44" height="20" rx="10" fill="var(--ill-shade)" stroke={ink} strokeWidth="2" />
      </g>

      {/* support headset */}
      <g transform="translate(390 70)">
        <circle cx="34" cy="34" r="34" fill="var(--ill-paper)" stroke={ink} strokeWidth="2.5" />
        <path d="M14 40 a 20 20 0 0 1 40 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <rect x="9" y="36" width="10" height="16" rx="5" fill="var(--ill-peacock)" stroke={ink} strokeWidth="2.5" />
        <rect x="49" y="36" width="10" height="16" rx="5" fill="var(--ill-peacock)" stroke={ink} strokeWidth="2.5" />
        <path d="M54 52 q 0 10 -12 12" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="40" cy="64" r="3.5" fill={ink} />
      </g>

      {/* technician */}
      <g transform="translate(470 150)">
        <circle cx="70" cy="40" r="26" fill="var(--ill-terracotta)" fillOpacity="0.35" stroke={ink} strokeWidth="2.5" />
        <path d="M42 34 a 28 22 0 0 1 56 0 z" fill="var(--ill-marigold)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="40" y="30" width="62" height="8" rx="4" fill="var(--ill-marigold)" stroke={ink} strokeWidth="2.5" />
        <path d="M24 196 v -70 a 46 46 0 0 1 92 0 v 70" fill="var(--ill-peacock)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M70 84 v 40" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        {/* toolbox */}
        <rect x="-26" y="160" width="74" height="44" rx="10" fill="var(--ill-terracotta)" stroke={ink} strokeWidth="2.5" />
        <path d="M-4 160 v -10 h 30 v 10" fill="none" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="-26" y="174" width="74" height="6" fill={ink} opacity="0.18" />
      </g>

      {/* sparkle: resolved */}
      <g transform="translate(600 70)" stroke="var(--ill-leaf)" strokeWidth="3" strokeLinecap="round">
        <path d="M0 -12 v 24 M-12 0 h 24" />
      </g>
    </svg>
  );
}
