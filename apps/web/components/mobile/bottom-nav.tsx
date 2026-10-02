"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Plus, Search, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";
import { focusOmnibox, openSaveDialog } from "@/lib/chrome-actions";

/**
 * The bottom tab bar — the header capsule's touch half.
 *
 * docs/design-system/patterns.md § Header capsule, "Responsive": below 900px
 * the capsule collapses to a single column and **destinations move into a
 * bottom tab bar on mobile (Home, Library, Save, Search, You)**. Those five,
 * in that order, are what this renders — the previous four were Home, Library,
 * Add and Explore, which left the account unreachable on touch and offered no
 * search at all.
 *
 * Save reaches the one **Save a link** dialog rather than owning a second one —
 * two dialogs would be two rate-limit states and two definitions of a valid
 * URL. Search focuses the header omnibox, which is on screen at every width;
 * the command palette is desktop chrome and renders nothing on touch, so the
 * tab used to open nothing at all.
 */
interface BottomNavLink {
  kind: "link";
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
}

interface BottomNavAction {
  kind: "action";
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

const LINKS: Omit<BottomNavLink, "icon">[] = [
  {
    kind: "link",
    label: "Home",
    href: "/my/dashboard",
    isActive: (pathname) => pathname === "/my/dashboard" || pathname === "/",
  },
  {
    kind: "link",
    label: "Library",
    href: "/my/library",
    isActive: (pathname) => pathname.startsWith("/my/library"),
  },
];

export function BottomNavigation() {
  const pathname = usePathname();
  // Both doors are named in lib/chrome-actions.ts, which keeps this bar a
  // leaf: it has no dialog, no rate-limit state and no idea what a valid URL is.
  const openSave = () => openSaveDialog();
  const openSearch = () => {
    window.scrollTo({ top: 0 });
    focusOmnibox();
  };

  const items: (BottomNavLink | BottomNavAction)[] = [
    { ...LINKS[0], icon: <Home aria-hidden="true" /> } as BottomNavLink,
    { ...LINKS[1], icon: <Library aria-hidden="true" /> } as BottomNavLink,
    {
      kind: "action",
      label: "Save",
      icon: <Plus aria-hidden="true" />,
      onPress: openSave,
    },
    {
      kind: "action",
      label: "Search",
      icon: <Search aria-hidden="true" />,
      onPress: openSearch,
    },
    {
      kind: "link",
      label: "You",
      href: "/my/profile",
      isActive: (path) => path.startsWith("/my/profile"),
      icon: <User aria-hidden="true" />,
    },
  ];

  // 44px touch targets, per rule ten. `min-h-[44px]` rather than padding that
  // happens to add up, so it stays true when the label wraps.
  const cell = cn(
    "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5",
    "font-sans text-[11px] font-medium leading-none",
    "transition-colors duration-cd-fast ease-cd",
    "[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:[stroke-width:1.8]",
    focusRing,
  );

  return (
    <nav
      aria-label="Primary, compact"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden safe-area-pb",
        "border-t border-line bg-bg-panel/95 backdrop-blur-[10px]",
      )}
    >
      <div className="mx-auto flex max-w-screen-sm items-stretch gap-1 px-2 py-1">
        {items.map((item) => {
          if (item.kind === "action") {
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onPress}
                className={cn(cell, "text-fg-secondary hover:text-fg")}
              >
                {item.icon}
                {item.label}
              </button>
            );
          }

          const active = item.isActive(pathname);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                cell,
                active ? "bg-accent-soft text-accent" : "text-fg-secondary hover:text-fg",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
