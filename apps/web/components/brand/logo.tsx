import * as React from "react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";
import styles from "./logo.module.css";

/** The approved artwork stays luminous on a permanent Plum shadow surface. */
function LogoArt({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/mark-128.webp"
      width={128}
      height={128}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** Compact placements use a gradient tile instead of squeezing the wordmark. */
export function LogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn(
        styles.surface,
        styles.tile,
        "inline-flex size-10 shrink-0 items-center justify-center",
        className,
      )}
    >
      <LogoArt className="h-[92%] w-[92%]" />
    </span>
  );
}

/** Full wordmark capsule, shared by headers, sidebar, auth pages and footer. */
export function Brandmark({
  className,
  href = "/",
  compact = false,
  compactOnMobile = false,
}: {
  className?: string;
  href?: string;
  compact?: boolean;
  /** Keep account actions reachable in the narrow public header. */
  compactOnMobile?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Cosmic Dolphin home"
      className={cn(
        styles.surface,
        compact ? cn(styles.tile, "size-11") : styles.capsule,
        compactOnMobile && !compact && styles.responsive,
        "inline-flex w-fit max-w-full shrink-0 items-center whitespace-nowrap font-sans text-[15px] font-semibold leading-none tracking-[-.015em]",
        focusRing,
        className,
      )}
    >
      <LogoArt className={compact ? "h-[92%] w-[92%]" : "size-10"} />
      {compact ? null : <span>Cosmic Dolphin</span>}
    </Link>
  );
}
