"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

interface AuthSubmitButtonProps {
  children: React.ReactNode;
}

export function AuthSubmitButton({ children }: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-11 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-full text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
    >
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {pending ? "Please wait..." : children}
    </button>
  );
}
