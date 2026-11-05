import { loadFont as loadHind } from "@remotion/google-fonts/HindVadodara";
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadMukta } from "@remotion/google-fonts/Mukta";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/*
 * Shared motion and type for the launch video. Every animation is frame-driven (no CSS
 * transitions); entrances use the app's ease-out curve so the video moves like the product.
 */
const instrument = loadInstrument("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const hind = loadHind("normal", { weights: ["400", "600"], subsets: ["gujarati"] });
const mukta = loadMukta("normal", { weights: ["400", "600"], subsets: ["devanagari"] });

/** Same values next/font provides in the app, so `font-sans` resolves identically. */
export const fontVars = {
  "--font-instrument": instrument.fontFamily,
  "--font-hind-vadodara": hind.fontFamily,
  "--font-mukta": mukta.fontFamily,
} as React.CSSProperties;

export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/** 0 → 1 between two frames on the app's ease-out, clamped. */
export function useProgress(from: number, to: number, easing = easeOut) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/** A settled spring (no bounce) starting at `delay` frames. */
export function useEnter(delay = 0, config: { damping?: number; stiffness?: number } = { damping: 200 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

/** The peacock mesh behind everything; `dark` switches every light-dark() token in the scene. */
export function Stage({ dark = false, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <AbsoluteFill className="mesh font-sans text-foreground" style={{ ...fontVars, colorScheme: dark ? "dark" : "light" }}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * Word-by-word reveal: each word rises 0.4em out of a soft blur, staggered. Few words per
 * frame, kinetic but calm.
 */
export function Words({
  text,
  start = 0,
  stagger = 4,
  className,
  wordClassName,
}: {
  text: string;
  start?: number;
  stagger?: number;
  className?: string;
  wordClassName?: (word: string, i: number) => string | undefined;
}) {
  const frame = useCurrentFrame();
  return (
    <span className={className}>
      {text.split(" ").map((word, i) => {
        const p = interpolate(frame, [start + i * stagger, start + i * stagger + 16], [0, 1], {
          easing: easeOut,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={i}
            className={wordClassName?.(word, i)}
            style={{
              display: "inline-block",
              marginRight: "0.25em",
              opacity: p,
              filter: `blur(${(1 - p) * 10}px)`,
              transform: `translateY(${(1 - p) * 0.4}em)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

/** Typed text, sliced by grapheme so Gujarati conjuncts never break mid-character. */
export function Typed({ text, start, perChar = 1.6 }: { text: string; start: number; perChar?: number }) {
  const frame = useCurrentFrame();
  const parts = [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
  const shown = Math.max(0, Math.min(parts.length, Math.floor((frame - start) / perChar)));
  return (
    <>
      {parts.slice(0, shown).join("")}
      {shown < parts.length && shown > 0 && <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] bg-current" />}
    </>
  );
}

/** A phone: glass bezel, rounded like the hardware, content on the app background. */
export function Phone({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`glass-strong rounded-[64px] p-3 shadow-[0_40px_80px_-30px_rgb(6_26_28/0.45)] ${className ?? ""}`}
      style={{ width: 420, height: 860, ...style }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[52px] bg-background">
        <div className="mx-auto mt-3 h-8 w-32 rounded-full bg-foreground" />
        {children}
      </div>
    </div>
  );
}
