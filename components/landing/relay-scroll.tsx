import { Illustration, type IllustrationName } from "@/components/shared/illustration";

const STATIONS: { who: string; title: string; body: string; art: IllustrationName }[] = [
  { who: "The customer", title: "Reports the fault", body: "From the order in their account, in Gujarati, with a photo of the leak.", art: "hero" },
  { who: "Maya in support", title: "Verifies and hands off", body: "Checks the warranty and writes a structured handoff for dispatch.", art: "support" },
  { who: "Arjun in dispatch", title: "Assigns the right person", body: "Picks a technician who covers Ahmedabad and opens the group chat.", art: "dispatch" },
  { who: "Ravi, technician", title: "Arrives knowing the story", body: "Fixes it, uploads proof, and the customer confirms. Case closed.", art: "technician" },
];

/**
 * "The relay": one scroll-driven sequence (CSS view timeline, no JS scroll listeners). The track
 * fills and each person lights up as the case reaches them. Browsers without scroll timelines
 * (and reduced motion) get the finished state.
 */
export function RelayScroll() {
  return (
    <section id="relay" className="relay-scroll relative md:h-[260vh]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:justify-center md:py-0">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-tight">Four people. One case. Nothing lost in between.</h2>
          <p className="text-lg text-muted-foreground">Everyone can see who has the case right now, and everything that happened before.</p>
        </div>
        <div className="relative mt-12 hidden h-1 rounded-full bg-[color-mix(in_oklab,var(--foreground)_10%,transparent)] md:block">
          <div className="relay-fill absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary" />
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {STATIONS.map(({ who, title, body, art }, i) => (
            <li key={who} className="relay-station panel space-y-1.5 rounded-xl p-5" style={{ ["--i" as string]: i }}>
              <Illustration name={art} decorative className="mb-3 rounded-[4px]" sizes="(min-width: 768px) 280px, 100vw" />
              <p className="text-xs font-semibold text-muted-foreground">{who}</p>
              <p className="text-lg font-semibold tracking-tight">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
