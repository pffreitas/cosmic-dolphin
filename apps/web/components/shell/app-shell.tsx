"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import type {
  BookmarkLibraryCounts,
  Collection,
} from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { HeaderOmnibox } from "@/components/header-omnibox";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { focusRing } from "@/components/ui/focus-ring";
import { openSaveDialog } from "@/lib/chrome-actions";

import { LibraryDndProvider } from "./library-dnd";
import { Sidebar, type ShellUser } from "./sidebar";
import { StarfieldHeaderBackground } from "./starfield-header";

/**
 * The signed-in app frame — docs/design-system/patterns.md § App shell.
 *
 *   ┌───────────┬──────────────────────────────────────┐
 *   │ sidebar   │ top bar · omnibox                    │
 *   │ 256px     ├──────────────────────────────────────┤
 *   │ sticky,   │ <main> — the page owns its width     │
 *   │ full      │                                      │
 *   │ height    │                                      │
 *   └───────────┴──────────────────────────────────────┘
 *
 * The sidebar is the app's persistent sense of place: destinations, the
 * Library and its AI-filed collections, the account. The top bar carries one
 * thing — the omnibox, which saves a pasted link and searches anything else —
 * so the product's primary action is in the same spot on every route.
 *
 * Below 1024px the sidebar becomes a sheet. On phones its trigger floats at
 * the bottom left; tablets keep the trigger in the top bar.
 */
export interface AppShellProps {
  user?: ShellUser;
  collections: Collection[];
  counts: BookmarkLibraryCounts | null;
  /** Rendered above the page inside <main>: the optimistic capture rows. */
  banner?: React.ReactNode;
  /** Overrides the router's path for the sidebar. Dev galleries only. */
  currentPath?: string;
  children: React.ReactNode;
}

export function AppShell({
  user,
  collections,
  counts,
  banner,
  currentPath,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const saveAfterClose = React.useRef(false);

  // A navigation always closes the sheet, including one made by the browser's
  // back button rather than by a click inside it. Adjusted during render, not
  // in an effect, so the sheet never paints one frame open on the new route.
  const [openedOn, setOpenedOn] = React.useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    if (navOpen) setNavOpen(false);
  }

  const sidebarProps = { user, collections, counts, currentPath };

  return (
    <LibraryDndProvider>
      <SkipLink />

      <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside
          aria-label="Sidebar"
          className="sticky top-0 hidden h-dvh border-r border-line bg-bg-subtle lg:block"
        >
          <Sidebar {...sidebarProps} />
        </aside>

        <div className="flex min-w-0 flex-col">
          <header
            className={cn(
              "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2",
              "border-b border-line bg-bg px-3 sm:px-4 lg:grid lg:grid-cols-[1fr_minmax(0,600px)_1fr] lg:px-10 max-md:h-[72px] max-md:isolate max-md:rounded-b-[var(--cd-radius-masthead)] max-md:border-0 max-md:bg-[color:var(--cd-sky-bg)]",
            )}
          >
            <StarfieldHeaderBackground />
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                  className={cn(
                    "lg:hidden",
                    "max-md:fixed max-md:bottom-[calc(env(safe-area-inset-bottom)+var(--cd-space-4))] max-md:left-[calc(env(safe-area-inset-left)+var(--cd-space-4))] max-md:z-40",
                    "max-md:size-12 max-md:rounded-pill max-md:border-0 max-md:bg-[color:var(--cd-nav-surface)] max-md:backdrop-blur-[10px]",
                    "max-md:text-accent-fg max-md:shadow-floating-nav max-md:hover:bg-accent-hover max-md:hover:text-accent-fg max-md:active:bg-accent-hover",
                  )}
                >
                  <Menu aria-hidden="true" className="!size-5 md:hidden" />
                  <PanelLeft aria-hidden="true" className="hidden md:block" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[288px] max-w-[85vw] flex-col gap-0 bg-bg-subtle p-0 sm:max-w-[288px]"
                onCloseAutoFocus={(event) => {
                  if (!saveAfterClose.current) return;
                  event.preventDefault();
                  saveAfterClose.current = false;
                  openSaveDialog();
                }}
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Destinations, your library and collections, and your account.
                </SheetDescription>
                <Sidebar
                  {...sidebarProps}
                  onNavigate={() => setNavOpen(false)}
                  onSave={() => { saveAfterClose.current = true; setNavOpen(false); }}
                />
              </SheetContent>
            </Sheet>

            <LogoMark className="size-8 lg:hidden" />

            {/* The omnibox sits on the content's centre axis on desktop. */}
            <div className="min-w-0 flex-1 sm:ml-2 lg:col-start-2 lg:ml-0">
              <HeaderOmnibox className="starfield-header-controls" />
            </div>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="flex-1 px-4 pb-20 pt-6 outline-none sm:px-6 md:pt-8 lg:px-10 max-md:bg-bg max-md:pb-28"
          >
            {banner}
            {children}
          </main>
        </div>
      </div>
    </LibraryDndProvider>
  );
}

/** First tab stop on every page: straight past the sidebar to the content. */
export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60]",
        "focus:rounded-sm focus:bg-bg-panel focus:px-3 focus:py-2 focus:font-sans focus:text-[13.5px] focus:font-medium focus:text-fg",
        "focus:shadow-[var(--cd-shadow-popover)]",
        focusRing,
      )}
    >
      Skip to content
    </a>
  );
}
