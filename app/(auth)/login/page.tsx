import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StaffSignInForm } from "./staff-sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Sign in to your service desk</h1>
        <p className="text-muted-foreground">For support agents, dispatchers, technicians and store owners.</p>
      </div>
      <Suspense fallback={<StaffSignInForm next="/" />}>
        {searchParams.then((sp) => (
          <StaffSignInForm next={typeof sp.next === "string" ? sp.next : "/"} />
        ))}
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Bought something and need help?{" "}
        <Link href="/verify" className="font-medium text-primary underline-offset-4 hover:underline">
          Get support with your email
        </Link>
      </p>
    </div>
  );
}
