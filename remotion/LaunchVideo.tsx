import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { HandoffCard } from "@/components/cases/handoff-card";
import { HeroScene } from "@/components/illustrations/hero-scene";
import { SpotWarranty } from "@/components/illustrations/spots";
import { LogoMark } from "@/components/shared/logo";
import { Phone, Stage, Typed, useEnter, useProgress, Words } from "./kit";

/*
 * RelayCare launch film, ~48s. Modelled on the references: airy kinetic type (Aave), word-by-word
 * reveals and depth-of-field zooms on real UI (Fomo), quick cuts and a logotype close (Spline).
 * The "screens" are the app's real components and tokens, not screenshots, so they stay sharp at 4K.
 */
const SCENES: { length: number; render: () => React.ReactNode }[] = [
  { length: 120, render: () => <Intro /> },
  { length: 180, render: () => <Problem /> },
  { length: 300, render: () => <Translate /> },
  { length: 270, render: () => <Handoff /> },
  { length: 240, render: () => <Relay /> },
  { length: 270, render: () => <Resolution /> },
  { length: 210, render: () => <Close /> },
];
const T = 15; // every cut overlaps by half a second
export const LAUNCH_DURATION = SCENES.reduce((n, s) => n + s.length, 0) - T * (SCENES.length - 1);

export function LaunchVideo() {
  return (
    <AbsoluteFill className="bg-background">
      <TransitionSeries>
        {SCENES.flatMap((s, i) => [
          i > 0 && (
            <TransitionSeries.Transition
              key={`t${i}`}
              presentation={i === 4 ? slide({ direction: "from-right" }) : fade()}
              timing={linearTiming({ durationInFrames: T })}
            />
          ),
          <TransitionSeries.Sequence key={i} durationInFrames={s.length}>
            {s.render()}
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

const h1 = "text-[128px] leading-[1.02] font-semibold tracking-[-0.045em]";
const h2 = "text-[88px] leading-[1.05] font-semibold tracking-[-0.04em]";

/* 1. The mark draws in, then the name. */
function Intro() {
  const mark = useEnter(4, { damping: 14, stiffness: 120 });
  const lift = useProgress(40, 70);
  return (
    <Stage>
      <AbsoluteFill className="items-center justify-center">
        <div style={{ transform: `translateY(${-lift * 80}px) scale(${0.6 + mark * 0.4})`, opacity: mark }}>
          <LogoMark className="size-[180px] drop-shadow-[0_30px_40px_rgb(10_107_104/0.35)]" />
        </div>
        <p className={`${h1} absolute top-[600px]`}>
          <Words text="Say hello to" start={46} className="text-muted-foreground" />
          <Words text="RelayCare." start={58} wordClassName={() => "text-primary"} />
        </p>
      </AbsoluteFill>
    </Stage>
  );
}

/* 2. One leak, four people. The baton travels the hero illustration. */
function Problem() {
  const baton = useProgress(30, 150);
  const zoom = useProgress(0, 180);
  return (
    <Stage>
      <AbsoluteFill className="flex-row items-center gap-12 px-[140px]">
        <div className="w-[760px] space-y-8">
          <p className={h2}>
            <Words text="A washing machine leaks." start={6} />
          </p>
          <p className="text-[56px] leading-[1.15] font-medium tracking-[-0.03em] text-muted-foreground">
            <Words text="Four people need to fix it." start={70} />
          </p>
        </div>
        <div className="flex-1" style={{ transform: `scale(${1 + zoom * 0.08})` }}>
          <HeroScene baton={baton} />
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/* 3. Gujarati in, English out, and back again. */
const GU = "મારું વોશિંગ મશીન સ્પિન વખતે નીચેથી પાણી લીક કરે છે.";
const EN = "My washing machine leaks water from the bottom during the spin cycle.";
const REPLY_EN = "Sorry about that. Could you send a photo of the leak?";
const REPLY_GU = "તકલીફ બદલ માફ કરશો. શું તમે લીકનો ફોટો મોકલી શકો?";

function Translate() {
  const frame = useCurrentFrame();
  const phone = useEnter(0);
  const desk = useEnter(110);
  const reply = useEnter(170);
  const back = useEnter(215);
  return (
    <Stage>
      <AbsoluteFill className="items-center justify-center gap-14" style={{ flexDirection: "row" }}>
        <Phone style={{ transform: `translateY(${(1 - phone) * 200}px)`, opacity: phone }}>
          <ChatHeader title="RC-2026-0042" sub="Support, Demo Electronics" />
          <div className="flex flex-1 flex-col justify-end gap-3 px-5 pb-6 text-[22px] leading-[1.4]">
            {frame > 140 && (
              <div className="mr-10 rounded-[20px] rounded-bl-md bg-card px-4 py-3" style={{ opacity: back }}>
                <span className="font-[family-name:var(--font-hind-vadodara)]">{REPLY_GU}</span>
                <p className="mt-1 text-sm text-muted-foreground">Maya, translated from English</p>
              </div>
            )}
            <div className="ml-10 self-end rounded-[20px] rounded-br-md bg-primary px-4 py-3 text-primary-foreground" style={{ order: -1 }}>
              <span className="font-[family-name:var(--font-hind-vadodara)]">
                <Typed text={GU} start={18} perChar={1.4} />
              </span>
            </div>
          </div>
        </Phone>

        <div className="panel w-[820px] space-y-5 rounded-2xl p-8" style={{ transform: `translateX(${(1 - desk) * 120}px)`, opacity: desk }}>
          <div className="flex items-baseline justify-between">
            <span className="font-tag text-2xl text-muted-foreground">RC-2026-0042</span>
            <span className="rounded-full bg-primary/12 px-4 py-1 text-lg font-semibold text-primary">Maya, Support</span>
          </div>
          <div className="mr-24 rounded-[20px] rounded-bl-md bg-secondary px-5 py-4 text-[28px] leading-[1.4]">
            {EN}
            <p className="mt-2 text-lg text-muted-foreground">Priya, translated from Gujarati</p>
          </div>
          <div
            className="ml-24 rounded-[20px] rounded-br-md bg-primary px-5 py-4 text-[28px] leading-[1.4] text-primary-foreground"
            style={{ opacity: reply, transform: `translateY(${(1 - reply) * 24}px)` }}
          >
            {REPLY_EN}
          </div>
        </div>
      </AbsoluteFill>
      <p className="absolute top-[64px] w-full text-center text-[56px] font-semibold tracking-[-0.03em]">
        <Words text="Everyone writes in their own language." start={120} stagger={3} />
      </p>
    </Stage>
  );
}

function ChatHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-4 border-b px-6 pb-4">
      <p className="font-tag text-xl font-semibold">{title}</p>
      <p className="text-base text-muted-foreground">{sub}</p>
    </div>
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
  const focus = useProgress(10, 80);
  const push = useProgress(150, 260);
  return (
    <Stage dark>
      <AbsoluteFill className="flex-row items-center gap-20 px-[140px]">
        <div className="w-[640px] space-y-6">
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

/* 5. The relay: the baton steps from person to person. */
const PEOPLE = [
  { name: "Priya", role: "Customer", lang: "Gujarati" },
  { name: "Maya", role: "Support", lang: "English" },
  { name: "Arjun", role: "Dispatch", lang: "English" },
  { name: "Ravi", role: "Technician", lang: "Hindi" },
];

function Relay() {
  const frame = useCurrentFrame();
  // one step per 40 frames, each eased
  const at = PEOPLE.slice(1).reduce((sum, _, i) => sum + interpolate(frame, [40 + i * 40, 64 + i * 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) }), 0);
  const card = useEnter(175);
  return (
    <Stage>
      <p className={`${h2} absolute top-[120px] w-full text-center`}>
        <Words text="One case. The story travels with it." start={4} stagger={3} />
      </p>
      <AbsoluteFill className="items-center justify-center pt-24">
        <div className="relative w-[1400px]">
          <div className="absolute top-[52px] right-[12.5%] left-[12.5%] h-1.5 rounded-full bg-border" />
          <div className="absolute top-[52px] left-[12.5%] h-1.5 rounded-full bg-foreground/60" style={{ width: `${(at / 3) * 75}%` }} />
          <div
            className="absolute top-[34px] z-10 h-[42px] w-28 -translate-x-1/2 rounded-full bg-baton shadow-[0_0_0_8px_var(--background),0_16px_30px_-10px_rgb(244_165_28/0.7)]"
            style={{ left: `${12.5 + (at / 3) * 75}%` }}
          />
          <ol className="relative grid grid-cols-4">
            {PEOPLE.map((p, i) => {
              const lit = interpolate(at, [i - 0.4, i], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <li key={p.name} className="flex flex-col items-center gap-4" style={{ opacity: 0.45 + lit * 0.55 }}>
                  <span className="grid size-[104px] place-items-center rounded-full bg-primary text-[44px] font-semibold text-primary-foreground ring-8 ring-background">
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
          className="glass-strong mt-16 flex items-center gap-5 rounded-2xl px-8 py-5 text-[28px]"
          style={{ opacity: card, transform: `translateY(${(1 - card) * 40}px) scale(${0.96 + card * 0.04})` }}
        >
          <span className="size-4 rounded-full bg-baton" />
          <span className="font-semibold">Ravi assigned.</span>
          <span className="text-muted-foreground">Visit on Saturday 8 November, 11:00. Group chat created.</span>
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/* 6. Repair report, the customer confirms, the numbers land. */
function Resolution() {
  const frame = useCurrentFrame();
  const left = useEnter(0);
  const right = useEnter(30);
  const press = frame >= 100 && frame < 106 ? 0.97 : 1;
  const done = frame >= 104;
  const stats = useEnter(150);
  const count = Math.round(interpolate(frame, [160, 210], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Stage>
      <p className={`${h2} absolute top-[64px] w-full text-center`}>
        <Words text="Closed when the customer says so." start={4} stagger={3} />
      </p>
      <AbsoluteFill className="flex-row items-center justify-center gap-16 pt-16" style={{ transform: `translateY(${-stats * 90}px)` }}>
        <div className="panel w-[560px] space-y-4 rounded-2xl p-7 text-[24px]" style={{ opacity: left, transform: `translateX(${(1 - left) * -80}px)` }}>
          <p className="text-lg text-muted-foreground">Ravi, repair report</p>
          <p className="text-[32px] font-semibold tracking-tight">Door seal replaced</p>
          <p className="text-muted-foreground">Seal was torn at the base. Drain pump clear. Leak test passed.</p>
          <div className="flex gap-3">
            <div className="grid h-28 flex-1 place-items-center rounded-xl bg-secondary">
              <SpotWarranty className="w-28" />
            </div>
            <div className="grid h-28 flex-1 place-items-center rounded-xl bg-secondary text-lg text-muted-foreground">after-repair.jpg</div>
          </div>
        </div>
        <div className="panel w-[520px] space-y-5 rounded-2xl p-7 text-[24px]" style={{ opacity: right, transform: `translateX(${(1 - right) * 80}px)` }}>
          <p className="text-lg text-muted-foreground">Priya, on her phone</p>
          <p className="text-[32px] font-semibold tracking-tight">Is your machine working now?</p>
          <div
            className={`grid h-16 place-items-center rounded-full font-semibold ${done ? "bg-success text-white" : "bg-primary text-primary-foreground"}`}
            style={{ transform: `scale(${press})` }}
          >
            {done ? "Resolved. Thank you!" : "Yes, it's fixed"}
          </div>
          <div className="grid h-16 place-items-center rounded-full bg-secondary font-semibold">No, still a problem</div>
        </div>
      </AbsoluteFill>
      <div className="absolute bottom-[90px] flex w-full justify-center gap-6" style={{ opacity: stats, transform: `translateY(${(1 - stats) * 60}px)` }}>
        {[
          ["4", "people on one case"],
          ["3", "languages, translated live"],
          ["1", "conversation, start to finish"],
          [String(count), "repeated explanations"],
        ].map(([n, label]) => (
          <div key={label} className="glass w-[340px] rounded-xl px-6 py-5">
            <p className="text-[64px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{n}</p>
            <p className="mt-2 text-xl text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* 7. Three short lines, then the logotype. */
function Close() {
  const frame = useCurrentFrame();
  const out = useProgress(96, 116);
  const logo = useEnter(112, { damping: 16, stiffness: 120 });
  return (
    <Stage>
      {frame < 120 && (
        <AbsoluteFill className="items-center justify-center" style={{ opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
          <p className={`${h1} text-center`}>
            <Words text="One purchase." start={2} />
            <br />
            <Words text="One journey." start={26} />
            <br />
            <Words text="One resolution." start={50} wordClassName={() => "text-primary"} />
          </p>
        </AbsoluteFill>
      )}
      <AbsoluteFill className="items-center justify-center gap-8" style={{ opacity: logo }}>
        <div className="flex items-center gap-8" style={{ transform: `scale(${0.85 + logo * 0.15})` }}>
          <LogoMark className="size-[150px]" />
          <span className="text-[150px] leading-none font-semibold tracking-[-0.05em]">RelayCare</span>
        </div>
        <p className="text-[36px] text-muted-foreground">
          <Words text="After-sales service for WooCommerce. Built on Nexconn." start={130} stagger={2} />
        </p>
      </AbsoluteFill>
    </Stage>
  );
}
