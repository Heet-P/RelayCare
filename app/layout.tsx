import type { Metadata, Viewport } from "next";
import { Hind_Vadodara, Instrument_Sans, Mukta } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

// Instrument Sans carries the Latin UI and the condensed "service tag" numerals (wdth axis).
// Devanagari (Hindi) and Gujarati fall back per-glyph to Mukta and Hind Vadodara.
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], axes: ["wdth"] });
const mukta = Mukta({ variable: "--font-mukta", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });
const hindVadodara = Hind_Vadodara({ variable: "--font-hind-vadodara", subsets: ["gujarati"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "RelayCare", template: "%s · RelayCare" },
  description: "One purchase. One connected service journey. One resolution.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrument.variable} ${mukta.variable} ${hindVadodara.variable}`}>
      <body className="min-h-dvh">
        {/* Warm wash behind every screen; glass surfaces pick it up. */}
        <div aria-hidden className="mesh pointer-events-none fixed inset-0 -z-10" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
