"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { OMNIBOX_INPUT_ID, focusOmnibox } from "@/lib/chrome-actions";

/**
 * `⌘K` / `Ctrl-K` — docs/design-system/patterns.md § Header capsule.
 *
 * One chord, two steps. The first press focuses the header omnibox, which
 * saves a pasted link and searches anything else. Pressing it again from the
 * omnibox opens the command palette with what was typed carried over — the
 * palette is still where collections, people and navigation live, it is just
 * one keystroke further away than the field that is always on screen.
 *
 * Where there is no omnibox (signed out, or a route that swaps it for a CTA)
 * the chord opens the palette directly, as it always did.
 *
 * `⌘/` used to be the binding. It is gone rather than kept as an alias: two
 * shortcuts for one thing means the product has no answer to "what opens
 * search", and the omnibox can only print one of them.
 */
export function GlobalKeyboardShortcuts() {
  const { open, toggle, openWith } = useCommandDialog();
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();

      // Inside the palette, the chord closes it.
      if (open) {
        toggle();
        return;
      }

      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.id === OMNIBOX_INPUT_ID) {
        const typed = active.value;
        active.blur();
        openWith(typed);
        return;
      }

      if (!focusOmnibox()) toggle();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, toggle, openWith, isMobile]);

  return null;
}
