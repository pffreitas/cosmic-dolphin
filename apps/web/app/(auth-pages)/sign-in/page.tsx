"use client";

import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SignInWith } from "./sign-in-with";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  
  // Build message object from search params
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const messageParam = searchParams.get("message");

  let message: Message = { message: "" };
  if (error) message = { error };
  else if (success) message = { success };
  else if (messageParam) message = { message: messageParam };

  if (!error && !success && !messageParam) {
    return (
      <div className="w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="text-2xl">🐬</div>
          <h2 className="font-noto text-lg font-normal text-gray-800">Cosmic Dolphin</h2>
        </div>

        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          Welcome back!
        </h1>
        <p className="text-sm text-gray-600 mb-5">
          Simplify your workflow and boost your productivity with <span className="font-semibold">Cosmic Dolphin</span>.
        </p>

        {/* Form */}
        <form action={signInAction} className="space-y-2.5">
          {/* Email field */}
          <Input
            name="email"
            type="email"
            placeholder="Username"
            required
            className="h-11 rounded-full border-gray-300 px-5 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-0"
          />

          {/* Password field */}
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
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

          {/* Forgot password link */}
          <div className="flex justify-end pt-0.5">
            <Link
              href="/forgot-password"
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Login button */}
          <button
            type="submit"
            className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-full text-sm transition-colors"
          >
            Login
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-500">or continue with</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Social login buttons */}
        <div className="flex justify-center gap-3">
          <SignInWith provider="google" />
          <SocialButton icon="apple" disabled />
          <SocialButton icon="facebook" disabled />
        </div>

        {/* Register link */}
        <p className="text-center mt-5 text-sm text-gray-600">
          Not a member?{" "}
          <Link
            href="/sign-up"
            className="text-[#7fb069] font-medium hover:text-[#6a9957] transition-colors"
          >
            Register now
          </Link>
        </p>
      </div>
    );
  }
}

function SocialButton({ icon, disabled }: { icon: "apple" | "facebook"; disabled?: boolean }) {
  const icons = {
    apple: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icons[icon]}
    </button>
  );
}
