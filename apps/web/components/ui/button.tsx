import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";

/**
 * Signal button — see docs/design-system/components.md#button.
 *
 *   primary    accent fill, no border, PILL      the one decisive action here
 *   secondary  panel fill, strong border, sm     everything else (the default)
 *   ghost      transparent, sm                   tertiary actions, dense rows
 *   danger     transparent + danger text, sm     destructive
 *   dangerSolid                                  the primary of a destructive dialog
 *
 * A pill on anything but `primary` dilutes the CTA and is a bug.
 *
 * `default` / `outline` / `destructive` are compatibility aliases for callers
 * written against shadcn's names; they resolve to primary / secondary / danger.
 */
const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "font-sans font-medium",
    "transition-colors duration-cd-fast ease-cd",
    "disabled:cursor-not-allowed disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:1.7]",
    focusRing,
  ),
  {
    variants: {
      variant: {
        primary:
          "rounded-pill border border-transparent bg-accent text-accent-fg hover:bg-accent-hover",
        secondary:
          "rounded-sm border border-line-strong bg-bg-panel text-fg hover:bg-bg-subtle",
        ghost:
          "rounded-sm border border-transparent bg-transparent text-fg-secondary hover:bg-bg-inset hover:text-fg",
        danger:
          "rounded-sm border border-line-strong bg-transparent text-[color:var(--cd-danger)] hover:bg-bg-inset",
        dangerSolid:
          "rounded-sm border border-transparent bg-[color:var(--cd-danger)] text-[color:var(--cd-bg)] hover:opacity-90",
        link: "rounded-sm border border-transparent bg-transparent text-accent underline-offset-4 hover:underline",

        // ---- compatibility aliases -------------------------------------
        default:
          "rounded-pill border border-transparent bg-accent text-accent-fg hover:bg-accent-hover",
        outline:
          "rounded-sm border border-line-strong bg-bg-panel text-fg hover:bg-bg-subtle",
        destructive:
          "rounded-sm border border-line-strong bg-transparent text-[color:var(--cd-danger)] hover:bg-bg-inset",
      },
      size: {
        // 12.5px label, 6×10px padding — floored at a 32px pointer target.
        sm: "h-8 px-2.5 text-[12.5px] leading-none",
        // 13.5px label, 9×14px padding.
        default: "min-h-9 px-3.5 py-[9px] text-[13.5px] leading-none",
        lg: "min-h-10 px-6 py-[11px] text-[13.5px] leading-none",
        icon: "h-[34px] w-[34px] p-0",
      },
    },
    compoundVariants: [
      // Primary carries wider shoulders than the rest: 9×18px.
      { variant: "primary", size: "default", class: "px-[18px]" },
      { variant: "default", size: "default", class: "px-[18px]" },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Leading icon. Kept as a prop rather than a child so the loading state can
   * replace it without touching the label.
   */
  icon?: React.ReactNode;
  /**
   * Swaps the leading icon for a 14px spinner and keeps the label. Never
   * replaces the label — the button would change width and the layout jumps.
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      icon,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // `asChild` hands rendering to the caller's single child; decorating it
    // would break Slot, so the leading slot is the caller's responsibility.
    const content = asChild ? (
      children
    ) : (
      <>
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="!size-3.5 animate-spin motion-reduce:animate-none motion-reduce:opacity-60"
          />
        ) : (
          icon
        )}
        {children}
      </>
    );

    // Slot forwards every prop to the caller's child, which may be an <a>;
    // `disabled` is not a valid attribute there, so only a real <button> gets it.
    const disabledProp = asChild
      ? disabled === undefined
        ? {}
        : { disabled }
      : { disabled: disabled ?? loading };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        {...disabledProp}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
