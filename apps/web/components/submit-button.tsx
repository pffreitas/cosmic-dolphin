"use client";

import { Button } from "@/components/ui/button";
import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUp } from "lucide-react";
import { useFormContext } from "react-hook-form"; // Import useFormContext

type Props = ComponentProps<typeof Button> & {
  pendingText?: string;
};

export function SubmitButton({
  children,
  pendingText = "Submitting...",
  ...props
}: Props) {
  const { pending } = useFormStatus();
  const formContext = useFormContext(); // Get form context
  const isValid = formContext ? formContext.formState.isValid : false; // Check if formContext is not null

  return (
    <Button
      type="submit"
      aria-disabled={pending || !isValid} // Disable if pending or form is invalid
      disabled={pending || !isValid} // Disable if pending or form is invalid
      {...props}
      className="rounded-full p-2"
    >
      {pending ? pendingText : <ArrowUp className="h-5 w-5" />}
    </Button>
  );
}
