"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

/** App-wide client providers: theme (class on <html>, read by light-dark() tokens) and toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}
