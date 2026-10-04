import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Brandmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/**
 * The signed-out header: the landing page, a shared save at `/s/[slug]`, and a
 * public profile at `/u/[handle]`. Full width, hairline below, brand left and
 * the two account doors right. `action` replaces the doors where a route has a
 * better single next step — `/s/[slug]` offers **Save to your library**.
 */
export function PublicHeader({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-line bg-bg",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Brandmark />
        <nav aria-label="Account" className="flex items-center gap-2">
          {action ?? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button variant="primary" asChild>
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
