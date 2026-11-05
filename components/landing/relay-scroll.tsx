import { EmptyJobs, SpotHandoff, SpotTranslate, SpotWarranty } from "@/components/illustrations/spots";

const STATIONS = [
  { who: "The customer", title: "Reports the fault", body: "From the order in their account, in Gujarati, with a photo of the leak.", Art: SpotTranslate },
  { who: "Maya in support", title: "Verifies and hands off", body: "Checks the warranty and writes a structured handoff for dispatch.", Art: SpotWarranty },
  { who: "Arjun in dispatch", title: "Assigns the right person", body: "Picks a technician who covers Ahmedabad and opens the group chat.", Art: SpotHandoff },
  { who: "Ravi, technician", title: "Arrives knowing the story", body: "Fixes it, uploads proof, and the customer confirms. Case closed.", Art: EmptyJobs },
];

/**
 * "The relay": one scroll-driven sequence (CSS view timeline, no JS scroll listeners). The
 * marigold baton travels the track and each station lights up as it is reached. Browsers
 * without scroll timelines (and reduced motion) get the finished state.
 */
export function RelayScroll() {
  return (
    <section id="relay" className="relay-scroll relative md:h-[260vh]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:justify-center md:py-0">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-tight">Four people. One case. Nothing lost in between.</h2>
          <p className="text-lg text-muted-foreground">The baton marks who holds the case right now. Everyone else can see it.</p>
        </div>
        <div className="relative mt-12 hidden h-2 rounded-full bg-[color-mix(in_oklab,var(--foreground)_10%,transparent)] md:block">
          <div className="relay-fill absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary" />
          <div className="relay-baton absolute top-1/2 left-full h-5 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-baton shadow-[0_0_0_5px_var(--background),0_6px_16px_-4px_rgb(244_165_28/0.6)]" />
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {STATIONS.map(({ who, title, body, Art }, i) => (
            <li key={who} className="relay-station panel space-y-2 rounded-xl p-5" style={{ ["--i" as string]: i }}>
              <Art className="h-20 w-auto" />
              <p className="text-xs font-semibold text-primary">{who}</p>
              <p className="text-lg font-semibold tracking-tight">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
