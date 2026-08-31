"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { forgotPasswordAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import { AuthField, AuthShell } from "../auth-shell";

/**
 * Forgot password — docs/design-system/pages.md § Auth.
 *
 * One field, so every error is about it. There is no field-routing to do here
 * and no fallback to pick: the message goes under the email input because that
 * is the only place it could belong.
 */
export default function ForgotPassword() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();

  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const notice = searchParams.get("message");

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send you a link to set a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className={cn(
              "rounded-sm font-medium text-accent underline-offset-4 hover:underline",
              focusRing,
            )}
          >
            Sign in
          </Link>
        </>
      }
    >
      <form action={forgotPasswordAction} className="flex flex-col gap-4">
        <AuthField
          label="Email"
          htmlFor="forgot-email"
          message={
            error ? (
              <FormMessage id="forgot-email-message" message={{ error }} />
            ) : success ? (
              <FormMessage message={{ success }} />
            ) : notice ? (
              <FormMessage message={{ message: notice }} />
            ) : null
          }
        >
          <Input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "forgot-email-message" : undefined}
          />
        </AuthField>

        <Button type="submit" variant="primary" className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
