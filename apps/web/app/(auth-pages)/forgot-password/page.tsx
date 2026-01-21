"use client";

import { forgotPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ForgotPassword() {
  const searchParams = useSearchParams();

  // Build message object from search params
  const message: Message | undefined = searchParams.get("error")
    ? { error: searchParams.get("error")! }
    : searchParams.get("success")
      ? { success: searchParams.get("success")! }
      : searchParams.get("message")
        ? { message: searchParams.get("message")! }
        : undefined;

  return (
    <div className="w-full">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="text-2xl">🐬</div>
        <h2 className="font-noto text-lg font-normal text-gray-800">
          Cosmic Dolphin
        </h2>
      </div>

      {/* Header */}
      <h1
        className="text-3xl font-bold text-gray-900 mb-1"
        style={{ fontFamily: "Georgia, serif" }}
      >
        Reset password
      </h1>
      <p className="text-sm text-gray-600 mb-5">
        Enter your email and we'll send you a link to reset your password.
      </p>

      {/* Form */}
      <form action={forgotPasswordAction} className="space-y-2.5">
        {/* Email field */}
        <Input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="h-11 rounded-full border-gray-300 px-5 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-0"
        />

        {/* Reset button */}
        <button
          type="submit"
          className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-full text-sm transition-colors"
        >
          Reset Password
        </button>

        {message && <FormMessage message={message} />}
      </form>

      {/* Back to sign in link */}
      <p className="text-center mt-5 text-sm text-gray-600">
        Remember your password?{" "}
        <Link
          href="/sign-in"
          className="text-[#7fb069] font-medium hover:text-[#6a9957] transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
