import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeroScene } from "@/components/illustrations/hero-scene";
import { SpotHandoff, SpotTranslate, SpotWarranty, EmptyJobs, EmptyOrders } from "@/components/illustrations/spots";
import { RelayScroll } from "@/components/landing/relay-scroll";
import { WorkspaceLink } from "@/components/landing/workspace-link";
import { Logo } from "@/components/shared/logo";
import { RelayStrip } from "@/components/shared/relay-strip";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata: Metadata = {
  title: "RelayCare — after-sales service that never loses the story",
  description: "One purchase. One connected service journey. One resolution. For WooCommerce electronics stores, powered by Nexconn.",
};

/** Marketing landing page. Static; only the sign-in / workspace button reads the session. */
export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <nav className="glass fixed inset-x-3 top-3 z-40 mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-full pr-2 pl-4">
        <Logo />
        <div className="ml-6 hidden gap-1 text-sm text-muted-foreground md:flex">
          <a href="#relay" className="pressable rounded-full px-3 py-2 hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="pressable rounded-full px-3 py-2 hover:text-foreground">
            For stores
          </a>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Suspense fallback={<Pill href="/login">Sign in</Pill>}>
            <WorkspaceLink />
          </Suspense>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-32 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-40">
        <div className="rise space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] px-3 py-1 text-sm font-medium text-primary">
            <span aria-hidden className="size-2 rounded-full bg-amber" /> For WooCommerce electronics stores
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-[4.25rem] sm:leading-[1.02]">
            After-sales service that never loses the story.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            When a washing machine leaks, the customer, your support team, dispatch and the technician share one case and one
            conversation. Everyone picks up exactly where the last person left off.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#relay" className="pressable inline-flex h-12 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)]">
              See how it works
            </a>
            <Link href="/verify" className="pressable glass inline-flex h-12 items-center rounded-full px-6 font-semibold">
              Get help with a purchase
            </Link>
          </div>
        </div>
        <div className="relative">
          <HeroScene animate />
          {/* Glass over illustration: the live case, as the team sees it */}
          <div className="glass-strong rise absolute -bottom-6 left-2 w-[min(22rem,90%)] space-y-3 rounded-xl p-4 [animation-delay:500ms] sm:left-8">
            <div className="flex items-baseline justify-between">
              <span className="font-tag text-sm text-muted-foreground">RC-2026-0042</span>
              <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary">Visit booked</span>
            </div>
            <p className="font-semibold">AquaWash 7kg, water leak</p>
            <RelayStrip current="technician" labels={{ customer: "Customer", agent: "Maya", dispatcher: "Arjun", technician: "Ravi" }} />
          </div>
        </div>
      </header>

      <RelayScroll />

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl space-y-10 px-4 py-24 sm:px-6">
        <div className="reveal max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-tight">Built for how service actually moves.</h2>
          <p className="text-lg text-muted-foreground">Every handoff carries the order, the product, the warranty and what was already tried.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Feature art={<SpotHandoff className="w-32" />} title="Context travels with the case">
            The technician gets a structured handoff before the visit: complaint, photos, serial number, warranty and the exact action required.
          </Feature>
          <Feature art={<SpotTranslate className="w-32" />} title="Gujarati, Hindi and English">
            Customers write in their language. Support reads English. Technicians reply in Hindi. Every message is translated for whoever reads it.
          </Feature>
          <Feature art={<EmptyOrders className="w-32" />} title="Starts from the real order">
            A Get Support button inside your WooCommerce store. Orders sync by signed webhooks, so a case always points at the actual purchase.
          </Feature>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Feature art={<SpotWarranty className="w-32" />} title="A person decides the warranty">
            Store rules suggest the cover dates; your team confirms each claim. Every decision is recorded with who made it and why.
          </Feature>
          <Feature art={<EmptyJobs className="w-32" />} title="A phone app for technicians">
            Jobs, the handoff, tap-to-call, photos and a completion report. The customer confirms the fix; nobody closes a case by saying “done” in chat.
          </Feature>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="reveal glass-strong relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-tight">
            One purchase. One service journey. One resolution.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Connect your store in minutes. Your customers never explain the same problem twice.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="pressable inline-flex h-12 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground">
              Open the service desk
            </Link>
            <Link href="/verify" className="pressable inline-flex h-12 items-center rounded-full bg-card px-6 font-semibold">
              I bought something
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-10 text-sm text-muted-foreground sm:px-6">
        <Logo />
        <p>Built for the Nexconn Build Challenge 2026. Powered by the Nexconn Chat SDK.</p>
      </footer>
    </div>
  );
}

function Feature({ art, title, children }: { art: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <article className="reveal panel space-y-3 rounded-xl p-6">
      <div className="grid h-28 place-items-start">{art}</div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </article>
  );
}

function Pill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="pressable inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
      {children}
    </Link>
  );
}
