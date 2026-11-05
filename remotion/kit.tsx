import { loadFont as loadHind } from "@remotion/google-fonts/HindVadodara";
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadMukta } from "@remotion/google-fonts/Mukta";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { graphemes } from "./timeline";

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

/** The warm wash behind everything; `dark` switches every light-dark() token in the scene. */
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
  const parts = graphemes(text);
  const shown = Math.max(0, Math.min(parts.length, Math.floor((frame - start) / perChar)));
  return (
    <>
      {parts.slice(0, shown).join("")}
      {shown < parts.length && shown > 0 && <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] bg-current" />}
    </>
  );
}

/**
 * A phone you can actually see on any background: solid graphite titanium frame with a lit
 * edge, black bezel, Dynamic Island, and the app's own background on the screen.
 * Radii nest: frame 68, bezel 10 → screen 58.
 */
export function Phone({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-[68px] bg-[linear-gradient(145deg,#4a443d,#1c1917_40%,#2b2622)] p-[3px] shadow-[0_50px_100px_-30px_rgb(28_25_23/0.55),0_20px_40px_-20px_rgb(28_25_23/0.4)] ${className ?? ""}`}
      style={{ width: 430, height: 880, ...style }}
    >
      <div className="h-full rounded-[65px] bg-[#0b0a09] p-[7px]">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[58px] bg-background">
          <div className="absolute top-3 left-1/2 z-10 h-9 w-32 -translate-x-1/2 rounded-full bg-[#0b0a09]" />
          <div className="flex h-14 items-end justify-between px-9 pb-1 text-sm font-semibold">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-[3px] border border-current p-px">
                <span className="block h-full w-3/4 rounded-[1px] bg-current" />
              </span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Zoom-through morph between scenes (the Fomo cut): the old scene pushes toward the camera and
 * dissolves into blur while the new one settles in from slightly behind, so the two read as one
 * continuous move rather than a crossfade.
 */
function ZoomBlur({ children, presentationDirection, presentationProgress }: TransitionPresentationComponentProps<Record<string, never>>) {
  const p = easeOut(presentationProgress);
  const entering = presentationDirection === "entering";
  const scale = entering ? 0.92 + 0.08 * p : 1 + 0.14 * p;
  const blur = entering ? (1 - p) * 18 : p * 18;
  const opacity = entering ? p : 1 - p;
  return <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>{children}</AbsoluteFill>;
}
export const zoomBlur = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomBlur, props: {} });
