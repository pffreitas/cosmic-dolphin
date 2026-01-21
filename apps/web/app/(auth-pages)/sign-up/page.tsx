"use client";

import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  
  // Build message object from search params
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const messageParam = searchParams.get("message");

  let message: Message = { message: "" };
  if (error) message = { error };
  if (success) message = { success };
  if (messageParam) message = { message: messageParam };

  // Show only the message if there's a message parameter
  if (searchParams.get("message")) {
    return (
      <div className="w-full flex-1 flex items-center justify-center">
        <FormMessage message={message} />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="text-2xl">🐬</div>
        <h2 className="font-noto text-lg font-normal text-gray-800">Cosmic Dolphin</h2>
      </div>

      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
        Create account
      </h1>
      <p className="text-sm text-gray-600 mb-5">
        Start your journey with <span className="font-semibold">Cosmic Dolphin</span>. It's free to get started.
      </p>

      {/* Form */}
      <form action={signUpAction} className="space-y-2.5">
        {/* Email field */}
        <Input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="h-11 rounded-full border-gray-300 px-5 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-0"
        />

        {/* Password field */}
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            minLength={6}
            required
            className="h-11 rounded-full border-gray-300 px-5 pr-11 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-0"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Sign up button */}
        <button
          type="submit"
          className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-full text-sm transition-colors"
        >
          Sign up
        </button>

        <FormMessage message={message} />
      </form>

      {/* Sign in link */}
      <p className="text-center mt-5 text-sm text-gray-600">
        Already have an account?{" "}
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
