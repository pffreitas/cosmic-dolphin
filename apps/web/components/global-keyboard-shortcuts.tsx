"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * `⌘K` / `Ctrl-K` opens the command palette
 * (docs/design-system/components.md#command-palette).
 *
 * `⌘/` used to be the binding. It is gone rather than kept as an alias: two
 * shortcuts for one thing means the product has no answer to "what opens
 * search", and the header chip can only print one of them.
 *
 * The listener does not fire while the user is typing into a field — except in
 * the palette's own input, where Radix's focus trap keeps the event inside the
 * dialog anyway and ⌘K should still close it.
 */
export function GlobalKeyboardShortcuts() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      toggle();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle, isMobile]);

  return null;
}
