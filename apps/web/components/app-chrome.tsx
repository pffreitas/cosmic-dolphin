"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppHeader, AppHeaderUser } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";

/**
 * The header capsule, bound to the app — D18.
 *
 * `AppHeader` (D3) is a presentational component: it takes a path, a list of
 * destinations, a user and two callbacks, and it knows nothing about routing,
 * the command palette or the save dialog. This is the thin client shell that
 * connects it to all three, and it exists so `app/layout.tsx` can stay a
 * server component that reads the session.
 *
 * Three things it deliberately does *not* do:
 *
 *  - **It does not render a second search field.** The capsule's search chip
 *    is a button that opens the palette. `command-dialog-trigger.tsx` used to
 *    sit beside the old header as a separate control; the capsule absorbed it,
 *    and two things that open the same palette is one thing too many.
 *  - **It does not carry a profile dropdown.** The avatar is a link to
 *    `/my/profile`, which is where the account lives now — sign-out included.
 *    A menu whose only two items are "Profile" and "Sign out" is a menu
 *    standing in front of a page.
 *  - **It does not branch on viewport.** The capsule is responsive by itself
 *    (below 900px it collapses to a single column and squares off), and the
 *    bottom tab bar is a separate component. Rendering two headers and hiding
 *    one is what the old layout did, and it is why every element in the tree
 *    existed twice.
 */
export interface AppChromeProps {
  isLoggedIn: boolean;
  /** From the session, on the server. Absent when signed out. */
  user?: AppHeaderUser;
  /** The save control. `NewBookmarkButton`, passed down so it stays a leaf. */
  saveAction?: React.ReactNode;
}

export function AppChrome({ isLoggedIn, user, saveAction }: AppChromeProps) {
  const pathname = usePathname();
  const { toggle } = useCommandDialog();

  if (!isLoggedIn) {
    return (
      <AppHeader
        currentPath={pathname}
        // Home, Library and Explore are all behind auth. Offering them to a
        // signed-out reader is offering three links to the sign-in page.
        destinations={[]}
        onSearch={undefined}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <AppHeader
      currentPath={pathname}
      user={user}
      onSearch={toggle}
      action={saveAction}
    />
  );
}
