import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BEATS, type Scene } from "../scripts/demo/script";
import { easeOut, Phone, Stage } from "./kit";
import takesJson from "./public/walkthrough/takes.json";

/*
 * The narrated product walkthrough: real recordings of the app (scripts/demo/record.ts) in a
 * browser window or a phone, the Sarvam narration placed at each beat, captions sentence by
 * sentence, and a gentle camera that leans in on whatever the narrator is talking about.
 */
type Box = { x: number; y: number; w: number; h: number };
type Beat = { id: string; t: number; focus?: Box; voice?: number | null };
type Take = { scene: Scene; device: "desktop" | "phone"; duration: number; beats: Beat[] };

const FPS = 30;
const TAKES = (takesJson as { takes: Take[] }).takes;
const SAY = Object.fromEntries(BEATS.map((b) => [b.id, b.say]));
const estimate = (id: string) => SAY[id].split(/\s+/).length / 2.7;

const CHAPTER: Record<Scene, string> = {
  intro: "RelayCare",
  customer: "1  The customer reports it",
  maya: "2  Support reviews and hands off",
  arjun: "3  Dispatch assigns a technician",
  ravi: "4  The technician repairs it",
  confirm: "5  The customer confirms",
  close: "6  The case is closed",
};

const starts = TAKES.reduce<number[]>((acc, t, i) => [...acc, i === 0 ? 0 : acc[i - 1] + Math.round(TAKES[i - 1].duration * FPS)], []);
export const WALKTHROUGH_DURATION = starts[starts.length - 1] + Math.round(TAKES[TAKES.length - 1].duration * FPS);

export function Walkthrough() {
  return (
    <AbsoluteFill className="bg-background">
      {TAKES.map((take, i) => (
        <Sequence key={take.scene} from={starts[i]} durationInFrames={Math.round(take.duration * FPS)}>
          <TakeView take={take} />
          {take.beats.map((b) =>
            b.voice ? (
              <Sequence key={b.id} from={Math.round(b.t * FPS)} durationInFrames={Math.ceil((b.voice + 0.2) * FPS)}>
                <Audio src={staticFile(`walkthrough/voice/${b.id}.wav`)} />
              </Sequence>
            ) : null,
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function TakeView({ take }: { take: Take }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const beatIndex = Math.max(0, take.beats.findLastIndex((b) => b.t <= t));
  const beat = take.beats[beatIndex];
  const enter = spring({ frame, fps, config: { damping: 200 } });

  return (
    <Stage>
      {take.device === "desktop" ? (
        <BrowserWindow take={take} beat={beat} enter={enter} />
      ) : (
        <AbsoluteFill className="flex-row items-center justify-center gap-24">
          <Phone style={{ width: 430, height: 900, transform: `translateY(${(1 - enter) * 60}px)`, opacity: enter }}>
            {/* the app's screen starts below the phone's status bar, like a real device */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <Video src={staticFile(`walkthrough/${take.scene}.mp4`)} className="absolute inset-0 h-full w-full object-cover object-top" muted />
            </div>
          </Phone>
          <SideNote take={take} />
        </AbsoluteFill>
      )}
      <ChapterPill scene={take.scene} />
      <Caption beat={beat} t={t} />
    </Stage>
  );
}

/** A quiet browser window; the camera eases toward the beat's focus box and back. */
function BrowserWindow({ take, beat, enter }: { take: Take; beat: Beat; enter: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sinceBeat = frame - Math.round(beat.t * fps);
  const lean = beat.focus ? spring({ frame: sinceBeat - 8, fps, config: { damping: 200 }, durationInFrames: 40 }) : 0;
  const f = beat.focus;
  // zoom so the focus fills ~70% of the window, capped at 1.35x; origin at the focus centre
  const zoom = f ? 1 + lean * (Math.min(1.35, 0.7 / Math.max(f.w, f.h)) - 1) : 1;
  const origin = f ? `${(f.x + f.w / 2) * 100}% ${(f.y + f.h / 2) * 100}%` : "50% 50%";
  return (
    <AbsoluteFill className="items-center justify-center pt-10">
      <div
        className="overflow-hidden rounded-[20px] border bg-card shadow-[0_40px_100px_-30px_rgb(28_25_23/0.45)]"
        style={{ width: 1440, transform: `translateY(${(1 - enter) * 50}px) scale(${0.97 + enter * 0.03})`, opacity: enter }}
      >
        <div className="flex h-11 items-center gap-2 border-b bg-secondary px-4">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="size-3 rounded-full" style={{ background: c }} />
          ))}
          <span className="mx-auto rounded-md bg-card px-24 py-1 text-sm text-muted-foreground">relaycare.app</span>
        </div>
        <div className="relative aspect-[1440/900] w-full overflow-hidden">
          <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
            <Video src={staticFile(`walkthrough/${take.scene}.mp4`)} className="h-full w-full" muted />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

const SIDE: Partial<Record<Scene, { who: string; lines: string[] }>> = {
  customer: { who: "The customer", lines: ["Phone, in Gujarati", "Reports from her real order", "Chats with support"] },
  ravi: { who: "Ravi, technician", lines: ["Phone, in Hindi", "Full handoff before the visit", "Report needs a photo"] },
  confirm: { who: "The customer", lines: ["Reads the report in Gujarati", "Confirms it's fixed", "Rates the service"] },
};

function SideNote({ take }: { take: Take }) {
  const frame = useCurrentFrame();
  const note = SIDE[take.scene];
  if (!note) return null;
  return (
    <div className="w-[520px] space-y-6">
      <p className="text-[56px] leading-[1.05] font-semibold tracking-[-0.035em]">{note.who}</p>
      <ul className="space-y-3">
        {note.lines.map((l, i) => {
          const p = interpolate(frame, [12 + i * 8, 30 + i * 8], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <li key={l} className="flex items-center gap-3 text-[28px] text-muted-foreground" style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
              <span className="size-2.5 rounded-full bg-amber" />
              {l}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChapterPill({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <div
      className="glass-strong absolute top-8 left-10 flex items-center gap-3 rounded-full px-5 py-2.5 text-xl font-semibold"
      style={{ opacity: p, transform: `translateY(${(1 - p) * -16}px)` }}
    >
      <span className="size-2.5 rounded-full bg-amber" />
      {CHAPTER[scene]}
    </div>
  );
}

/** The sentence being spoken, timed by its share of the beat's voice length. */
function Caption({ beat, t }: { beat: Beat; t: number }) {
  const sentences = SAY[beat.id].split(/(?<=[.!?])\s+/);
  const total = beat.voice ?? estimate(beat.id);
  const chars = sentences.reduce((n, s) => n + s.length, 0);
  let acc = 0;
  const into = t - beat.t;
  const current =
    sentences.find((s) => {
      acc += (s.length / chars) * total;
      return into < acc;
    }) ?? null;
  if (!current || into < 0) return null;
  return (
    <div className="absolute inset-x-0 bottom-7 flex justify-center px-40">
      <p className="rounded-2xl bg-[rgb(28_25_23/0.82)] px-6 py-3 text-center text-[28px] leading-[1.35] text-white">{current}</p>
    </div>
  );
}
