"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Header capsule — see docs/design-system/patterns.md#header-capsule.
 *
 * A glass capsule floating on a tinted band. The band is what carries brand
 * colour into the app; the capsule stays translucent so the page reads through
 * it. Letting it go opaque throws away the whole idea.
 *
 * The capsule is a three-column grid, `1fr auto 1fr` — not flexbox with a
 * spacer. That is the load-bearing detail: it keeps the centre column
 * optically centred even when the left and right columns are different widths,
 * which is what makes the header feel stable as counts and names change.
 *
 * Below 900px the grid collapses to a single column and the capsule squares off
 * to `--cd-radius-lg`. On mobile the destinations move into a bottom tab bar,
 * which is a separate component and not this one's business.
 *
 * Page-level actions do not go in here, and it never grows past 56px.
 */
export interface AppHeaderDestination {
  label: string;
  href: string;
}

/** Home, Library, Explore — the only three destinations the capsule carries. */
export const APP_HEADER_DESTINATIONS: readonly AppHeaderDestination[] = [
  { label: "Home", href: "/my/dashboard" },
  { label: "Library", href: "/my/library" },
  { label: "Explore", href: "/explore" },
] as const;

export interface AppHeaderUser {
  name: string;
  /** `profiles.picture_url`. Falls back to initials on the accent. */
  avatarUrl?: string | null;
  /** Profile route. Without it the avatar is decorative. */
  href?: string;
}

export interface AppHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Usually `usePathname()`. Decides which destination is `aria-current`. */
  currentPath?: string;
  destinations?: readonly AppHeaderDestination[];
  user?: AppHeaderUser;
  /**
   * Opens the command palette. The search chip is a button, never a real
   * input — a second focusable text field competing with ⌘K is a trap.
   */
  onSearch?: () => void;
  /** The one primary action in the capsule. */
  onSave?: () => void;
  /** Renders **Save a link** as a link rather than a button. */
  saveHref?: string;
  saveLabel?: string;
  /** Replaces the Save-a-link control entirely — `/s/[slug]` swaps in its CTA. */
  action?: React.ReactNode;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function isActive(currentPath: string | undefined, href: string): boolean {
  if (!currentPath) return false;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * 20px accent square with an offset dot, then the wordmark at 14px/600.
 *
 * Exported because the auth pages need the same mark above their form, and a
 * second hand-drawn copy of it is how two brandmarks start disagreeing.
 */
export function Brandmark() {
  return (
    <Link
      href="/"
      aria-label="Cosmic Dolphin home"
      className={cn(
        "flex items-center gap-2.5 whitespace-nowrap rounded-pill",
        "font-sans text-sm font-semibold leading-none tracking-[-.01em] text-fg",
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className="relative size-5 shrink-0 rounded-sm bg-accent"
      >
        <span className="absolute right-1.5 top-1.5 size-[5px] rounded-pill bg-accent-fg opacity-90" />
      </span>
      Cosmic Dolphin
    </Link>
  );
}

const AppHeader = React.forwardRef<HTMLElement, AppHeaderProps>(
  (
    {
      className,
      currentPath,
      destinations = APP_HEADER_DESTINATIONS,
      user,
      onSearch,
      onSave,
      saveHref,
      saveLabel = "Save a link",
      action,
      ...props
    },
    ref,
  ) => {
    const saveButton =
      action ??
      (saveHref ? (
        <Button variant="primary" size="sm" asChild>
          <Link href={saveHref}>{saveLabel}</Link>
        </Button>
      ) : (
        <Button variant="primary" size="sm" type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      ));

    return (
      <header
        ref={ref}
        className={cn(
          // The tinted band, with 16px of bleed below the capsule.
          "bg-[linear-gradient(180deg,var(--cd-nav-band-top)_0%,var(--cd-nav-band-bot)_100%)]",
          "px-4 pb-4",
          className,
        )}
        {...props}
      >
        <nav
          aria-label="Primary"
          className={cn(
            "grid grid-cols-[1fr_auto_1fr] items-center gap-4",
            "rounded-pill border border-[color:var(--cd-nav-edge)]",
            "bg-[image:var(--cd-nav-glass)]",
            "py-2 pl-[18px] pr-2",
            "shadow-[var(--cd-nav-shadow),inset_0_1px_0_var(--cd-nav-sheen)]",
            "backdrop-blur-[10px] backdrop-saturate-[1.7]",
            "max-[900px]:grid-cols-1 max-[900px]:gap-3 max-[900px]:rounded-lg max-[900px]:p-3.5",
          )}
        >
          <div className="flex min-w-0 items-center">
            <Brandmark />
          </div>

          <div className="flex items-center gap-0.5 justify-self-center max-[900px]:flex-wrap max-[900px]:justify-self-start">
            {destinations.map((destination) => {
              const active = isActive(currentPath, destination.href);
              return (
                <Link
                  key={destination.href}
                  href={destination.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-pill px-3.5 py-[7px]",
                    "font-sans text-[13.5px] font-medium leading-none",
                    "text-fg-secondary transition-colors duration-cd-fast ease-cd hover:text-fg",
                    active &&
                      "bg-[color:var(--cd-nav-pill)] text-fg shadow-sm",
                    focusRing,
                  )}
                >
                  {destination.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 justify-self-end max-[900px]:flex-wrap max-[900px]:justify-self-start">
            {/*
              No handler, no chip. A search button that opens nothing is worse
              than an absent one — it is a control that lies about what the
              surface can do, and the signed-out header has no palette behind
              it.
            */}
            {onSearch ? (
            <button
              type="button"
              onClick={onSearch}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-pill",
                "border border-[color:var(--cd-nav-edge)] bg-[color:var(--cd-nav-pill)]",
                "py-[7px] pl-[13px] pr-2",
                "font-sans text-[13px] leading-none text-fg-tertiary",
                "transition-colors duration-cd-fast ease-cd hover:text-fg-secondary",
                focusRing,
              )}
            >
              <Search aria-hidden="true" className="size-3.5 [stroke-width:1.8]" />
              Search
              <Kbd className="border-transparent border-b bg-transparent">⌘K</Kbd>
            </button>
            ) : null}

            {saveButton}

            {user ? (
              user.href ? (
                <Link
                  href={user.href}
                  aria-label={`${user.name} — your profile`}
                  className={cn("rounded-pill", focusRing)}
                >
                  <Avatar>
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Avatar>
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
              )
            ) : null}
          </div>
        </nav>
      </header>
    );
  },
);
AppHeader.displayName = "AppHeader";

export { AppHeader };