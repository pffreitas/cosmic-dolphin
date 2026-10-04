"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type {
  BookmarkLibraryCounts,
  Collection,
} from "@cosmic-dolphin/api-client";

import { AppShell, SkipLink } from "@/components/shell/app-shell";
import { PublicHeader } from "@/components/shell/public-header";
import type { ShellUser } from "@/components/shell/sidebar";
import { PendingCaptures } from "@/components/bookmark/pending-captures";

/**
 * Which frame a route sits in — docs/design-system/patterns.md § App shell.
 *
 * `app/layout.tsx` is a server component that knows the session but not the
 * path; this is the thin client seam that knows both. Three frames:
 *
 *  - **Bare** — routes that draw their own frame: the landing page, the auth
 *    pages (a split-screen of their own), and the `/dev/*` state galleries,
 *    which render the app shell around fixture data so the signed-in frame can
 *    be inspected without a session.
 *  - **App shell** — signed in: sidebar, top bar with the omnibox, one <main>.
 *  - **Public** — signed out on a public route (`/s/[slug]`, `/u/[handle]`):
 *    the public header above one <main>.
 *
 * Pages never render a <main> of their own; the frame owns the one landmark.
 */
const BARE_PREFIXES = [
  "/dev",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/protected/reset-password",
];

export function isBareRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return BARE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export interface AppChromeProps {
  isLoggedIn: boolean;
  /** From the session, on the server. Absent when signed out. */
  user?: ShellUser;
  collections: Collection[];
  counts: BookmarkLibraryCounts | null;
  children: React.ReactNode;
}

export function AppChrome({
  isLoggedIn,
  user,
  collections,
  counts,
  children,
}: AppChromeProps) {
  const pathname = usePathname() ?? "/";

  if (isBareRoute(pathname)) return <>{children}</>;

  if (isLoggedIn) {
    return (
      <AppShell
        user={user}
        collections={collections}
        counts={counts}
        // The optimistic capture row. It sits above the page because the
        // omnibox works from every route, so the row has to appear wherever
        // the paste happened. Nothing renders when nothing is in flight, and
        // nothing on Home, which shows captures in its own Saving now strip.
        banner={<PendingCaptures />}
      >
        {children}
      </AppShell>
    );
  }

  return (
    <>
      <SkipLink />
      <PublicHeader />
      <main id="main" tabIndex={-1} className="px-4 pb-20 pt-8 outline-none sm:px-6">
        {children}
      </main>
    </>
  );
}
