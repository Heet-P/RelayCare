"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SmoothScroll } from "./smooth-scroll";

/** App-wide client providers: theme (class on <html>, read by light-dark() tokens) and toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SmoothScroll>
        <TooltipProvider>{children}</TooltipProvider>
      </SmoothScroll>
      <Toaster position="top-center" closeButton />
    </ThemeProvider>
  );
}
