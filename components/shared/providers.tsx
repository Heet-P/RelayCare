"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** App-wide client providers: theme (class on <html>, read by light-dark() tokens) and toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}
