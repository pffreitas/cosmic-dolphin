"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { signUpAction } from "@/app/actions";
import { FormMessage, fieldForAuthError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import { AuthField, AuthShell } from "../auth-shell";

/**
 * Sign up — docs/design-system/pages.md § Auth.
 *
 * The old page replaced the entire form with a floating message whenever
 * `?message=` was present, which is how "check your email" arrived: the user
 * confirmed nothing and had no way back to the form except the browser's back
 * button. The confirmation now renders **with** the form still on the page.
 */
export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const notice = searchParams.get("message");

  // Sign-up failures are usually about the address — "already registered" is
  // the common one — so email is the fallback here, not password.
  const errorField = error ? fieldForAuthError(error, "email") : null;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save a link and Cosmic Dolphin reads it, summarises it and files it. Free to start."
      footer={
        <>
          Already have an account?{" "}
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
      <form action={signUpAction} className="flex flex-col gap-4">
        <AuthField
          label="Email"
          htmlFor="sign-up-email"
          message={
            errorField === "email" ? (
              <FormMessage id="sign-up-email-message" message={{ error: error! }} />
            ) : null
          }
        >
          <Input
            id="sign-up-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={errorField === "email"}
            aria-describedby={
              errorField === "email" ? "sign-up-email-message" : undefined
            }
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor="sign-up-password"
          message={
            errorField === "password" ? (
              <FormMessage
                id="sign-up-password-message"
                message={{ error: error! }}
              />
            ) : (
              <p className="font-sans text-[12.5px] leading-[1.45] text-fg-tertiary">
                At least 6 characters.
              </p>
            )
          }
        >
          <div className="relative">
            <Input
              id="sign-up-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Choose a password"
              minLength={6}
              required
              className="pr-10"
              aria-invalid={errorField === "password"}
              aria-describedby={
                errorField === "password" ? "sign-up-password-message" : undefined
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

        {success ? <FormMessage message={{ success }} /> : null}
        {notice ? <FormMessage message={{ message: notice }} /> : null}

        <Button type="submit" variant="primary" className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
