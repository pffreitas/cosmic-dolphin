import * as React from "react";

import { cn } from "@/lib/utils";
import { focusRingInset } from "./focus-ring";

/**
 * Signal field surface — see docs/design-system/components.md#input-textarea-select.
 * Shared with `textarea` and the `select` trigger so the three cannot drift.
 *
 * Errors are never colour alone: the caller sets `aria-invalid` and points
 * `aria-describedby` at helper text that says what is wrong.
 */
export const fieldSurface = cn(
  "w-full rounded-md border border-line-strong bg-bg-panel",
  "font-sans text-sm text-fg",
  "placeholder:text-fg-tertiary",
  "transition-colors duration-cd-fast ease-cd",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "aria-[invalid=true]:border-[color:var(--cd-danger)]",
  focusRingInset,
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * The URL-capture field is the ONE input that takes a pill. Every other field
   * is a rectangle — a stray pill reads as a decisive action and dilutes the CTA.
   */
  shape?: "rect" | "pill";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, shape = "rect", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldSurface,
          "flex h-10 px-3 py-2.5",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg",
          shape === "pill" && "rounded-pill px-4",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
