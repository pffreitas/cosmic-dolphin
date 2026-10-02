"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, Home, Library, Search, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Header capsule — see docs/design-system/patterns.md#header-capsule.
 *
 * An opaque glass capsule floating directly on the page. Layered colour,
 * edge highlights and a cool shadow provide the glass depth without allowing
 * page content to show through the surface.
 *
 * The capsule is a content-sized row: brand · destinations · divider ·
 * omnibox · avatar. It shrink-wraps its contents instead of stretching across
 * the viewport.
 *
 * Below 1000px the destination labels drop to glyphs. Below 900px the capsule
 * wraps, squares off to `--cd-radius-lg`, and the omnibox takes its own
 * full-width row. On mobile the destinations move into a bottom tab bar,
 * which is a separate component and not this one's business.
 *
 * The omnibox is passed in, not built here: this component stays
 * presentational and knows nothing about the store, the router or the
 * palette. `app-chrome.tsx` binds it. Without one — signed out, the patterns
 * gallery, `/s/[slug]` — the capsule falls back to its search chip and a
 * single action.
 *
 * Page-level actions do not go in here, and its first row never grows past
 * 56px.
 */
export interface AppHeaderDestination {
  label: string;
  href: string;
  /** 15px glyph before the label; the only thing left of it below 1000px. */
  icon?: LucideIcon;
}

/** Home, Library, Explore — the only three destinations the capsule carries. */
export const APP_HEADER_DESTINATIONS: readonly AppHeaderDestination[] = [
  { label: "Home", href: "/my/dashboard", icon: Home },
  { label: "Library", href: "/my/library", icon: Library },
  { label: "Explore", href: "/explore", icon: Compass },
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
   * The header omnibox — one field that saves a pasted link and searches
   * anything else. When present it replaces both the search chip and the
   * action: the capsule carries exactly one text field and no Save button.
   */
  omnibox?: React.ReactNode;
  /**
   * Opens the command palette from the search chip. Only used without an
   * omnibox. The chip is a button, never a real input — the omnibox is the
   * one real field the capsule is allowed.
   */
  onSearch?: () => void;
  /** The one primary action in the capsule, when there is no omnibox. */
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
 * 20px dolphin mark, then the wordmark at 14px/600.
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
        className="inline-flex size-5 shrink-0 items-center justify-center text-[18px] leading-none"
      >
        🐬
      </span>
      Cosmic Dolphin
    </Link>
  );
}

function UserAvatar({ user }: { user: AppHeaderUser }) {
  const avatar = (
    <Avatar>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
      <AvatarFallback>{initials(user.name)}</AvatarFallback>
    </Avatar>
  );

  if (!user.href) return avatar;

  return (
    <Link
      href={user.href}
      aria-label={`${user.name} — your profile`}
      className={cn("shrink-0 rounded-pill", focusRing)}
    >
      {avatar}
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
      omnibox,
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
      ) : onSave ? (
        <Button variant="primary" size="sm" type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      ) : null);

    return (
      <header
        ref={ref}
        className={cn("flex justify-center px-4 py-3", className)}
        {...props}
      >
        <nav
          aria-label="Primary"
          className={cn(
            "inline-flex w-fit max-w-full items-center gap-3.5",
            "isolate",
            "rounded-pill border border-[color:var(--cd-nav-edge)]",
            "bg-[image:var(--cd-nav-glass)]",
            "py-1.5 pl-4 pr-1.5",
            "shadow-[var(--cd-nav-shadow),inset_0_1px_0_var(--cd-nav-sheen)]",
            "max-[900px]:flex-wrap max-[900px]:rounded-lg max-[900px]:py-2 max-[900px]:pl-3.5 max-[900px]:pr-2",
          )}
        >
          <Brandmark />

          {destinations.length > 0 ? (
            <div className="flex items-center gap-0.5 max-md:hidden">
              {destinations.map((destination) => {
                const active = isActive(currentPath, destination.href);
                const Icon = destination.icon;
                return (
                  <Link
                    key={destination.href}
                    href={destination.href}
                    aria-current={active ? "page" : undefined}
                    // Below 1000px the label is visually gone; the name stays.
                    aria-label={Icon ? destination.label : undefined}
                    className={cn(
                      "inline-flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-pill px-3",
                      "font-sans text-[13.5px] font-medium leading-none",
                      "text-fg-secondary transition-colors duration-cd-fast ease-cd hover:text-fg",
                      "max-[1000px]:px-2.5",
                      active && "bg-[color:var(--cd-nav-pill)] text-fg shadow-sm",
                      focusRing,
                    )}
                  >
                    {Icon ? (
                      <Icon aria-hidden="true" className="size-[15px] shrink-0 [stroke-width:1.8]" />
                    ) : null}
                    <span className={cn(Icon && "max-[1000px]:hidden")}>
                      {destination.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {omnibox ? (
            <>
              <span
                aria-hidden="true"
                className="h-5 w-px shrink-0 bg-line max-[900px]:hidden"
              />
              <div className="min-w-0 max-[900px]:order-last max-[900px]:basis-full">
                {omnibox}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
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
            </div>
          )}

          {user ? (
            <span className="shrink-0 max-[900px]:ml-auto">
              <UserAvatar user={user} />
            </span>
          ) : null}
        </nav>
      </header>
    );
  },
);
AppHeader.displayName = "AppHeader";

export { AppHeader };
