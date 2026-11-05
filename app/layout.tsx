import type { Metadata, Viewport } from "next";
import { Archivo, Hind_Vadodara, Mukta } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

// Archivo carries the Latin UI and the semi-condensed "service tag" numerals (wdth axis).
// Devanagari (Hindi) and Gujarati fall back per-glyph to Mukta and Hind Vadodara.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const mukta = Mukta({ variable: "--font-mukta", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });
const hindVadodara = Hind_Vadodara({ variable: "--font-hind-vadodara", subsets: ["gujarati"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "RelayCare", template: "%s · RelayCare" },
  description: "One purchase. One connected service journey. One resolution.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1920" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${mukta.variable} ${hindVadodara.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
