"use client";

import * as React from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { DevThemeToggle } from "@/app/dev/dev-theme-toggle";
import { COLLECTIONS, COUNTS } from "@/app/dev/fixtures";

/**
 * The signed-in frame around a dev gallery.
 *
 * `/dev/*` routes are bare in `AppChrome` — there is no session behind them —
 * so each gallery wraps itself in the real `AppShell` with fixture data. What
 * shows here is therefore exactly the frame `/my/*` shows: the same sidebar,
 * the same top bar, the same <main>. The dashed strip at the top is the only
 * thing that is not product, and it says so.
 */
export function DevShell<T extends string>({
  title,
  currentPath,
  states,
  state,
  onStateChange,
  children,
}: {
  title: string;
  /** The product route this gallery stands in for, for the sidebar. */
  currentPath: string;
  states: readonly { value: T; label: string }[];
  state: T;
  onStateChange: (state: T) => void;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      currentPath={currentPath}
      user={{ name: "Paulo Freitas", email: "paulo@cosmic.dev", href: "/my/profile" }}
      collections={COLLECTIONS}
      counts={COUNTS}
    >
      <div className="mx-auto mb-8 flex w-full max-w-[1100px] flex-wrap items-center gap-3 rounded-md border border-dashed border-line-strong bg-bg-subtle px-3 py-2">
        <span className="font-sans text-[12px] font-semibold text-fg-tertiary">
          Dev · {title}
        </span>
        <Segmented
          aria-label={`${title} state`}
          value={state}
          onValueChange={(value) => onStateChange(value as T)}
        >
          {states.map((option) => (
            <SegmentedItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedItem>
          ))}
        </Segmented>
        <div className="ml-auto">
          <DevThemeToggle />
        </div>
      </div>
      {children}
    </AppShell>
  );
}
