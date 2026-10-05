"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { identityClass } from "@/lib/identity";

/**
 * Avatar — see docs/design-system/components.md#avatar.
 *
 *   inline    22px   inside a provenance row
 *   default   26px   everywhere else
 *   lg        36px   comment threads
 *
 * Falls back to initials, never to a generic silhouette. The initials sit on
 * the person's identity hue (`lib/identity.ts`), seeded by `seed` — a handle
 * or user id — or by the initials themselves when no seed is given, so the
 * same person is the same colour on every row.
 */
const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-pill bg-bg-inset",
  {
    variants: {
      size: {
        inline: "size-[22px] text-[9px]",
        default: "size-[26px] text-[10px]",
        lg: "size-9 text-[13px]",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size }), className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export interface AvatarFallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  /** Picks the identity hue. A handle or id; defaults to the text content. */
  seed?: string;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, seed, children, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-pill",
      "font-sans text-[length:inherit] font-semibold uppercase",
      identityClass(seed ?? (typeof children === "string" ? children : "")),
      className,
    )}
    {...props}
  >
    {children}
  </AvatarPrimitive.Fallback>
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback, avatarVariants };
