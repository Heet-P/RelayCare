import { Illustration } from "@/components/shared/illustration";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Sign-in: the form floats on glass; beside it, an illustration and one line of story.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
        <Logo />
        <ThemeToggle />
      </header>

      <section className="flex items-center justify-center px-4 pt-24 pb-10 sm:px-10">
        <div className="glass-strong rise w-full max-w-md rounded-2xl p-6 sm:p-8">{children}</div>
      </section>

      <aside className="relative hidden flex-col justify-center gap-10 overflow-hidden px-12 lg:flex">
        <Illustration name="technician" priority className="rise max-w-2xl rounded-2xl [animation-delay:120ms]" sizes="(min-width: 1024px) 640px, 0px" />
        <div className="max-w-lg space-y-3">
          <p className="text-3xl font-semibold tracking-tight text-balance">
            The technician already knows what happened.
          </p>
          <p className="text-lg text-muted-foreground text-balance">
            One purchase. One connected service journey. One resolution.
          </p>
        </div>
      </aside>
    </main>
  );
}
