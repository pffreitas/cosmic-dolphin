"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { signInAction } from "@/app/actions";
import { FormMessage, fieldForAuthError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import { AuthField, AuthShell } from "../auth-shell";
import { SignInWith } from "./sign-in-with";

/**
 * Sign in — docs/design-system/pages.md § Auth.
 *
 * Two bugs went out with the restyle, and both were worse than the styling:
 *
 *  1. **The page rendered nothing when there was a message.** The whole body
 *     sat inside `if (!error && !success && !messageParam)`, with no `else`.
 *     So a failed sign-in redirected back to `/sign-in?error=…` and the user
 *     got a blank page — the one moment the form is most needed.
 *  2. **Two of the three provider buttons did nothing.** Apple and Facebook
 *     were rendered `disabled` with no explanation. A control for something
 *     the product cannot do is a promise it cannot keep; they are gone rather
 *     than greyed.
 *
 * The error now renders under the field it is about, never as a banner.
 */
export default function Login() {
  return (
    // `useSearchParams` needs a boundary or the whole route opts out of static
    // rendering with a build-time warning. The fallback cannot be the form
    // itself — it reads the same hook and would suspend again.
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const notice = searchParams.get("message");

  // Which field the sentence is about. Sign-in failures are overwhelmingly
  // about the credential pair, so the password field is the fallback.
  const errorField = error ? fieldForAuthError(error, "password") : null;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to reach your library, your feed and everything you have saved."
      footer={
        <>
          Not a member yet?{" "}
          <Link
            href="/sign-up"
            className={cn(
              "rounded-sm font-medium text-accent underline-offset-4 hover:underline",
              focusRing,
            )}
          >
            Create an account
          </Link>
        </>
      }
    >
      <form action={signInAction} className="flex flex-col gap-4">
        <AuthField
          label="Email"
          htmlFor="sign-in-email"
          message={
            errorField === "email" ? (
              <FormMessage id="sign-in-email-message" message={{ error: error! }} />
            ) : null
          }
        >
          <Input
            id="sign-in-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={errorField === "email"}
            aria-describedby={
              errorField === "email" ? "sign-in-email-message" : undefined
            }
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor="sign-in-password"
          message={
            errorField === "password" ? (
              <FormMessage
                id="sign-in-password-message"
                message={{ error: error! }}
              />
            ) : null
          }
        >
          <div className="relative">
            <Input
              id="sign-in-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              required
              className="pr-10"
              aria-invalid={errorField === "password"}
              aria-describedby={
                errorField === "password" ? "sign-in-password-message" : undefined
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className={cn(
                "absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm",
                "text-fg-tertiary transition-colors duration-cd-fast ease-cd hover:text-fg-secondary",
                focusRing,
              )}
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        </AuthField>

        {/* Not an error, so not attached to a field. */}
        {success ? <FormMessage message={{ success }} /> : null}
        {notice ? <FormMessage message={{ message: notice }} /> : null}

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className={cn(
              "rounded-sm font-sans text-[12.5px] leading-none text-fg-secondary underline-offset-4 hover:text-fg hover:underline",
              focusRing,
            )}
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" variant="primary" className="w-full">
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-sans text-[12px] leading-none text-fg-tertiary">
          or
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <SignInWith provider="google" />
    </AuthShell>
  );
}
