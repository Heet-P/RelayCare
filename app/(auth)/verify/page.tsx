import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CodeSignInForm } from "./code-sign-in-form";

export const metadata: Metadata = { title: "Get support" };

/** Customer sign-in by email code. Reached directly or from the store's "Get Support" button. */
export default function VerifyPage({ searchParams }: PageProps<"/verify">) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Get help with your purchase</h1>
        <p className="text-muted-foreground">
          Use the email address you shopped with. We&apos;ll send a 6-digit code to confirm it&apos;s you.
        </p>
      </div>
      <Suspense fallback={<CodeSignInForm next="/" />}>
        {searchParams.then((sp) => (
          <CodeSignInForm
            next={typeof sp.next === "string" ? sp.next : "/"}
            email={typeof sp.email === "string" ? sp.email : undefined}
          />
        ))}
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Work for the store?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in to the service desk
        </Link>
      </p>
    </div>
  );
}
