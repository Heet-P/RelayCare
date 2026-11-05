"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { sendCode, verifyCode, type AuthState } from "../actions";

/** Two steps in one form: email → code. Server actions keep the session in httpOnly cookies. */
export function CodeSignInForm({ next, email }: { next: string; email?: string }) {
  const [sent, send, sending] = useActionState<AuthState, FormData>(sendCode, { email });
  const [verified, verify, verifying] = useActionState<AuthState, FormData>(verifyCode, {});
  const error = verified.error ?? sent.error;

  if (!sent.sent) {
    return (
      <form action={send} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={sent.email} className="h-11" />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={sending}>
          {sending ? "Sending code…" : "Email me a code"}
        </Button>
      </form>
    );
  }

  return (
    <form action={verify} className="space-y-4">
      <input type="hidden" name="email" value={sent.email} />
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="token">Code sent to {sent.email}</Label>
        <InputOTP id="token" name="token" maxLength={6} autoFocus inputMode="numeric" autoComplete="one-time-code">
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={verifying}>
        {verifying ? "Checking…" : "Continue"}
      </Button>
      <button formAction={send} formNoValidate className="h-11 text-sm text-primary underline-offset-4 hover:underline" disabled={sending}>
        Send a new code
      </button>
    </form>
  );
}
