import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { Camera, CheckCheck } from "lucide-react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { HandoffCard } from "@/components/cases/handoff-card";
import { LogoMark } from "@/components/shared/logo";
import { easeOut, Phone, Stage, Typed, useEnter, useProgress, Words, zoomBlur } from "./kit";
import { BAR, CUE, DURATION, GU_COMPLAINT, ORDER, SCENE_BARS, T, type SceneKey } from "./timeline";

/*
 * RelayCare launch film, 52s at 120 BPM. Modelled on the references: airy kinetic type (Aave),
 * word-by-word reveals, zoom-through morphs and depth of field on real UI (Fomo), fast cuts and
 * a logotype close (Spline). Screens are the app's real components and tokens; the score
 * (remotion/score.ts) is composed from the same cue sheet, so every cut and pop lands on the beat.
 */
export const LAUNCH_DURATION = DURATION;

const RENDER: Record<SceneKey, () => React.ReactNode> = {
  intro: () => <Intro />,
  problem: () => <Problem />,
  translate: () => <Translate />,
  handoff: () => <Handoff />,
  relay: () => <Relay />,
  resolution: () => <Resolution />,
  close: () => <Close />,
};

export function LaunchVideo() {
  return (
    <AbsoluteFill className="bg-background">
      <Audio src={staticFile("score.mp3")} />
      <TransitionSeries>
        {ORDER.flatMap((k, i) => [
          i > 0 && <TransitionSeries.Transition key={`t-${k}`} presentation={zoomBlur()} timing={linearTiming({ durationInFrames: T })} />,
          // each scene runs one transition longer so the next one starts exactly on its bar line
          <TransitionSeries.Sequence key={k} durationInFrames={SCENE_BARS[k] * BAR + (i < ORDER.length - 1 ? T : 0)}>
            {RENDER[k]()}
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

const h1 = "text-[128px] leading-[1.02] font-semibold tracking-[-0.045em]";
const h2 = "text-[88px] leading-[1.05] font-semibold tracking-[-0.04em]";

/* 1. The mark arrives, the name follows, then the tile grows to become the next scene. */
function Intro() {
  const c = CUE.intro;
  const mark = useEnter(c.mark, { damping: 14, stiffness: 120 });
  const lift = useProgress(c.words - 10, c.words + 20);
  const grow = useProgress(c.expand, c.expand + 39, (t) => t * t * t);
  return (
    <Stage>
      <AbsoluteFill className="items-center justify-center">
        <div style={{ transform: `translateY(${-lift * 80 * (1 - grow)}px) scale(${(0.6 + mark * 0.4) * (1 + grow * 40)})`, opacity: mark }}>
          <LogoMark className="size-[180px] drop-shadow-[0_30px_40px_rgb(28_25_23/0.3)]" />
        </div>
        <p className={`${h1} absolute top-[600px]`} style={{ opacity: 1 - grow * 3 }}>
          <Words text="Say hello to" start={c.words} className="text-muted-foreground" />
          <Words text="RelayCare." start={c.words + 12} />
        </p>
      </AbsoluteFill>
    </Stage>
  );
}

/* 2. The problem: one leak, a dozen scattered questions. They collapse into one case. */
const SCATTER = [
  { who: "Priya", text: "It's leaking again!", x: 980, y: 170, r: -3 },
  { who: "Support", text: "Which order was this?", x: 1300, y: 330, r: 2 },
  { who: "Priya", text: "I sent the photo yesterday", x: 900, y: 470, r: 2 },
  { who: "Dispatch", text: "What's the address?", x: 1350, y: 600, r: -2 },
  { who: "Technician", text: "Is it under warranty?", x: 950, y: 750, r: -1 },
  { who: "Priya", text: "Why do I have to repeat this?", x: 1250, y: 880, r: 3 },
];

function Problem() {
  const frame = useCurrentFrame();
  const c = CUE.problem;
  const collapse = useProgress(c.collapse, c.collapse + 18, (t) => t * t * (3 - 2 * t));
  const card = useEnter(c.card, { damping: 18, stiffness: 160 });
  return (
    <Stage dark>
      <AbsoluteFill className="justify-center px-[140px]">
        <div className="w-[720px] space-y-6" style={{ opacity: 1 - collapse }}>
          <p className={h2}>
            <Words text="One leak." start={4} />
          </p>
          <p className="text-[64px] leading-[1.1] font-semibold tracking-[-0.035em] text-muted-foreground">
            <Words text="A dozen scattered questions." start={20} stagger={3} />
          </p>
        </div>
        <div className="absolute left-[140px] w-[760px]" style={{ opacity: card }}>
          <p className={h2}>
            <Words text="RelayCare makes it" start={c.card - 4} />
            <Words text="one case." start={c.card + 8} wordClassName={() => "text-amber"} />
          </p>
        </div>
      </AbsoluteFill>
      {SCATTER.map((b, i) => {
        const pop = interpolate(frame, [c.pops[i], c.pops[i] + 8], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        // every bubble flies into the case card's position as the scene collapses
        const x = b.x + (1350 - b.x) * collapse;
        const y = b.y + (540 - b.y) * collapse;
        return (
          <div
            key={i}
            className="absolute rounded-[22px] rounded-bl-md bg-card px-6 py-4 text-[28px] shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)]"
            style={{
              left: x,
              top: y,
              transform: `translate(-50%, -50%) rotate(${b.r * (1 - collapse)}deg) scale(${(0.9 + pop * 0.1) * (1 - collapse * 0.7)})`,
              opacity: pop * (1 - collapse),
            }}
          >
            <p className="text-lg text-muted-foreground">{b.who}</p>
            {b.text}
          </div>
        );
      })}
      <div
        className="absolute top-1/2 left-[1350px] w-[640px] space-y-4 rounded-[32px] border bg-card p-8"
        style={{ transform: `translate(-50%, -50%) scale(${0.85 + card * 0.15})`, opacity: card }}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-tag text-2xl text-muted-foreground">RC-2026-0042</span>
          <span className="flex items-center gap-2 text-xl font-semibold">
            <span className="size-3 rounded-full bg-amber" /> With Maya
          </span>
        </div>
        <p className="text-[40px] leading-tight font-semibold tracking-tight">AquaWash 7kg, water leak</p>
        <p className="text-2xl text-muted-foreground">Order WC-10842, warranty, photos and the whole conversation, in one place.</p>
      </div>
    </Stage>
  );
}

/* 3. Gujarati in, English out, and back again. */
const EN = "My washing machine leaks water from the bottom during the spin cycle.";
const REPLY_EN = "Sorry about that. Could you send a photo of the leak?";
const REPLY_GU = "તકલીફ બદલ માફ કરશો. શું તમે લીકનો ફોટો મોકલી શકો?";

function Translate() {
  const c = CUE.translate;
  const phone = useEnter(0);
  const desk = useEnter(c.desk);
  const reply = useEnter(c.reply);
  const back = useEnter(c.back);
  return (
    <Stage>
      <p className="absolute top-[56px] w-full text-center text-[56px] font-semibold tracking-[-0.03em]">
        <Words text="Everyone writes in their own language." start={c.desk + 6} stagger={3} />
      </p>
      <AbsoluteFill className="flex-row items-center justify-center gap-20 pt-20">
        <Phone style={{ transform: `translateY(${(1 - phone) * 240}px) rotate(${(1 - phone) * -4}deg)`, opacity: phone }}>
          <div className="border-b px-7 pb-4">
            <p className="font-tag text-xl font-semibold">RC-2026-0042</p>
            <p className="text-base text-muted-foreground">Support, Demo Electronics</p>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3 px-5 pb-8 text-[22px] leading-[1.45]">
            <div className="ml-10 self-end rounded-[22px] rounded-br-md bg-primary px-5 py-3 text-primary-foreground">
              <span lang="gu">
                <Typed text={GU_COMPLAINT} start={c.typeFrom} perChar={c.perChar} />
              </span>
            </div>
            <div
              className="mr-10 rounded-[22px] rounded-bl-md bg-card px-5 py-3"
              style={{ opacity: back, transform: `translateY(${(1 - back) * 20}px) scale(${0.96 + back * 0.04})` }}
            >
              <span lang="gu">{REPLY_GU}</span>
              <p className="mt-1 text-sm text-muted-foreground">Maya, translated from English</p>
            </div>
          </div>
        </Phone>

        <div
          className="panel w-[820px] space-y-5 rounded-[32px] p-8"
          style={{ transform: `translateX(${(1 - desk) * 120}px)`, opacity: desk, filter: `blur(${(1 - desk) * 10}px)` }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-tag text-2xl text-muted-foreground">RC-2026-0042</span>
            <span className="rounded-full bg-secondary px-4 py-1 text-lg font-semibold">Maya, Support</span>
          </div>
          <div className="mr-24 rounded-[22px] rounded-bl-md bg-secondary px-6 py-4 text-[28px] leading-[1.4]">
            {EN}
            <p className="mt-2 text-lg text-muted-foreground">Priya, translated from Gujarati</p>
          </div>
          <div
            className="ml-24 rounded-[22px] rounded-br-md bg-primary px-6 py-4 text-[28px] leading-[1.4] text-primary-foreground"
            style={{ opacity: reply, transform: `translateY(${(1 - reply) * 24}px) scale(${0.96 + reply * 0.04})` }}
          >
            {REPLY_EN}
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/* 4. The handoff card, in the dark, pulled into focus. */
const SNAPSHOT = {
  version: 1,
  case: "RC-2026-0042",
  product: "AquaWash 7kg Front Load",
  serialNumber: "AW7-DEMO-0042",
  order: { number: "WC-10842", purchasedAt: "2026-10-20" },
  customer: { name: "Priya", phone: null, email: "priya@example.com", address: null, language: "gu" },
  issue: "water_leak",
  complaint: "Water leaks from the bottom during the spin cycle.",
  symptoms: ["Leak under the drum, only while spinning", "Started three days ago"],
  troubleshooting: ["Inlet hose checked and tightened", "Ran an empty cycle, still leaks"],
  warranty: "Eligible until 20 Oct 2027, verified by Maya",
  actionRequired: "Inspect the door seal and drain pump. Replace the seal if worn.",
  priority: "high",
  evidence: [
    { id: "1", fileName: "leak-photo.jpg" },
    { id: "2", fileName: "spin-cycle.mp4" },
  ],
  notes: null,
  preparedBy: "Maya",
  preparedAt: "2026-11-06T10:00:00Z",
};

function Handoff() {
  const c = CUE.handoff;
  const focus = useProgress(c.focus, c.focus + 70);
  const push = useProgress(c.push, c.push + 90);
  return (
    <Stage dark>
      <AbsoluteFill className="flex-row items-center gap-20 px-[140px]">
        <div className="w-[640px] space-y-6" style={{ opacity: 1 - push * 0.6 }}>
          <p className={h2}>
            <Words text="Nothing gets lost." start={20} />
          </p>
          <p className="text-[40px] leading-[1.3] tracking-[-0.02em] text-muted-foreground">
            <Words text="The technician gets the whole story before the visit." start={60} stagger={3} />
          </p>
        </div>
        <div style={{ perspective: 1600 }}>
          <div
            className="w-[860px] text-[22px] [&_.text-sm]:text-xl [&_.text-xs]:text-lg"
            style={{
              transformOrigin: "50% 85%",
              transform: `rotateX(${(1 - focus) * 22}deg) translateY(${(1 - focus) * 120}px) scale(${0.9 + focus * 0.1 + push * 0.22})`,
              filter: `blur(${(1 - focus) * 12}px)`,
              opacity: focus,
            }}
          >
            <HandoffCard snapshot={SNAPSHOT} compact />
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/* 5. Who has it now: the amber ring glides from person to person, on the beat. */
const PEOPLE = [
  { name: "Priya", role: "Customer", lang: "Gujarati" },
  { name: "Maya", role: "Support", lang: "English" },
  { name: "Arjun", role: "Dispatch", lang: "English" },
  { name: "Ravi", role: "Technician", lang: "Hindi" },
];

function Relay() {
  const frame = useCurrentFrame();
  const c = CUE.relay;
  const at = c.steps.reduce((sum, f) => sum + interpolate(frame, [f - 6, f + 8], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0);
  const card = useEnter(c.card);
  const strip = useEnter(4);
  return (
    <Stage>
      <p className={`${h2} absolute top-[120px] w-full text-center`}>
        <Words text="Everyone can see who has it." start={4} stagger={3} />
      </p>
      <AbsoluteFill className="items-center justify-center pt-24">
        <div className="relative w-[1400px]" style={{ opacity: strip, transform: `translateY(${(1 - strip) * 40}px)` }}>
          <div className="absolute top-[52px] right-[12.5%] left-[12.5%] h-0.5 bg-border" />
          <div className="absolute top-[52px] left-[12.5%] h-0.5 bg-foreground/50" style={{ width: `${(at / 3) * 75}%` }} />
          {/* one ring gliding between avatars: a morph, not four separate rings */}
          <div
            className="absolute top-[-8px] z-20 size-[120px] -translate-x-1/2 rounded-full border-[5px] border-amber"
            style={{ left: `${12.5 + (at / 3) * 75}%` }}
          />
          <ol className="relative z-10 grid grid-cols-4">
            {PEOPLE.map((p, i) => {
              const lit = interpolate(at, [i - 0.5, i], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const done = at >= i + 0.5;
              return (
                <li key={p.name} className="flex flex-col items-center gap-4" style={{ opacity: 0.4 + lit * 0.6 }}>
                  <span className={`grid size-[104px] place-items-center rounded-full text-[44px] font-semibold ${done ? "bg-foreground text-background" : "border-2 bg-card"}`}>
                    {p.name[0]}
                  </span>
                  <span className="text-[36px] font-semibold tracking-tight">{p.name}</span>
                  <span className="-mt-3 text-2xl text-muted-foreground">
                    {p.role}, {p.lang}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div
          className="glass-strong mt-16 flex items-center gap-5 rounded-full px-8 py-5 text-[28px]"
          style={{ opacity: card, transform: `translateY(${(1 - card) * 40}px) scale(${0.96 + card * 0.04})` }}
        >
          <span className="size-4 rounded-full bg-amber" />
          <span className="font-semibold">Ravi assigned.</span>
          <span className="text-muted-foreground">Visit on Saturday at 11:00. Group chat created.</span>
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/* 6. Repair report, the customer confirms on her phone, the numbers land. */
function Resolution() {
  const frame = useCurrentFrame();
  const c = CUE.resolution;
  const left = useEnter(0);
  const right = useEnter(20);
  const press = frame >= c.press && frame < c.press + 5 ? 0.96 : 1;
  const done = frame >= c.press + 4;
  const morph = useProgress(c.press + 4, c.press + 16);
  const stats = useEnter(c.stats);
  const count = Math.round(interpolate(frame, [c.stats + 10, c.stats + 60], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Stage>
      <p className={`${h2} absolute top-[56px] w-full text-center`} style={{ opacity: 1 - stats }}>
        <Words text="Closed when the customer says so." start={4} stagger={3} />
      </p>
      <AbsoluteFill
        className="flex-row items-center justify-center gap-20 pt-24"
        style={{ transform: `translateY(${-stats * 150}px) scale(${1 - stats * 0.12})` }}
      >
        <div className="panel w-[600px] space-y-4 rounded-[32px] p-8 text-[24px]" style={{ opacity: left, transform: `translateX(${(1 - left) * -80}px)` }}>
          <p className="text-lg text-muted-foreground">Ravi, repair report</p>
          <p className="text-[36px] font-semibold tracking-tight">Door seal replaced</p>
          <p className="text-muted-foreground">Seal was torn at the base. Drain pump clear. Leak test passed.</p>
          <div className="flex gap-3">
            {["before.jpg", "after.jpg"].map((f) => (
              <div key={f} className="flex h-32 flex-1 flex-col items-center justify-center gap-2 rounded-[20px] bg-secondary text-lg text-muted-foreground">
                <Camera className="size-7" strokeWidth={1.75} />
                {f}
              </div>
            ))}
          </div>
        </div>
        <Phone style={{ width: 380, height: 720, opacity: right, transform: `translateX(${(1 - right) * 80}px)` }}>
          <div className="flex flex-1 flex-col justify-center gap-5 px-7 text-[22px]">
            <p className="text-base text-muted-foreground">RC-2026-0042</p>
            <p className="text-[34px] leading-tight font-semibold tracking-tight">Is your machine working now?</p>
            <div
              className={`relative grid h-16 place-items-center overflow-hidden rounded-full font-semibold ${done ? "bg-success text-white" : "bg-primary text-primary-foreground"}`}
              style={{ transform: `scale(${press})` }}
            >
              {/* the label blurs across as the button morphs into its done state */}
              <span className="absolute" style={{ opacity: 1 - morph, filter: `blur(${morph * 6}px)` }}>
                Yes, it&apos;s fixed
              </span>
              <span className="absolute flex items-center gap-2" style={{ opacity: morph, filter: `blur(${(1 - morph) * 6}px)` }}>
                <CheckCheck className="size-6" /> Resolved
              </span>
            </div>
            <div className="grid h-16 place-items-center rounded-full bg-secondary font-semibold">No, still a problem</div>
          </div>
        </Phone>
      </AbsoluteFill>
      <div className="absolute bottom-[80px] flex w-full justify-center gap-6" style={{ opacity: stats, transform: `translateY(${(1 - stats) * 60}px)` }}>
        {[
          ["4", "people on one case"],
          ["3", "languages, translated live"],
          ["1", "conversation, start to finish"],
          [String(count), "repeated explanations"],
        ].map(([n, label]) => (
          <div key={label} className="panel w-[340px] rounded-[24px] px-7 py-6">
            <p className="text-[72px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{n}</p>
            <p className="mt-2 text-xl text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* 7. Three short lines blur into the logotype. */
function Close() {
  const frame = useCurrentFrame();
  const c = CUE.close;
  const out = useProgress(c.out, c.out + 20);
  const logo = useEnter(c.logo, { damping: 16, stiffness: 120 });
  return (
    <Stage>
      {frame < c.logo + 10 && (
        <AbsoluteFill className="items-center justify-center" style={{ opacity: 1 - out, filter: `blur(${out * 14}px)`, transform: `scale(${1 - out * 0.06})` }}>
          <p className={`${h1} text-center`}>
            <Words text="One purchase." start={14} />
            <br />
            <Words text="One journey." start={34} />
            <br />
            <Words text="One resolution." start={54} wordClassName={() => "text-amber-ink"} />
          </p>
        </AbsoluteFill>
      )}
      <AbsoluteFill className="items-center justify-center gap-8" style={{ opacity: logo, filter: `blur(${(1 - logo) * 14}px)` }}>
        <div className="flex items-center gap-8" style={{ transform: `scale(${0.9 + logo * 0.1})` }}>
          <LogoMark className="size-[150px]" />
          <span className="text-[150px] leading-none font-semibold tracking-[-0.05em]">RelayCare</span>
        </div>
        <p className="text-[36px] text-muted-foreground">
          <Words text="After-sales service for WooCommerce. Built on Nexconn." start={c.logo + 18} stagger={2} />
        </p>
      </AbsoluteFill>
    </Stage>
  );
}
