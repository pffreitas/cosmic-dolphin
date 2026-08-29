"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { focusRing } from "@/components/ui/focus-ring";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * The header's search chip — a **button that opens the palette, not a real
 * input** (docs/design-system/patterns.md § Header capsule).
 *
 * It used to carry its own surface: `bg-white`, `border-gray-300`,
 * `bg-gray-50` keycaps. That is what D2 flagged — a screen does not get its
 * own button, and raw colours do not survive a theme. It is now the field
 * surface's tokens plus the shared `Kbd`.
 *
 * The shortcut is rendered from a `mounted` flag rather than straight off
 * `navigator`. The server cannot know which platform is asking, and a `⌘` in
 * the server render against a `Ctrl` in the first client render is a text
 * mismatch — which React answers by abandoning hydration, leaving a page that
 * screenshots perfectly and whose every control is dead.
 */
export function CommandDialogTrigger() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();
  const [modifier, setModifier] = React.useState<string | null>(null);

  React.useEffect(() => {
    const mac = /mac|iphone|ipad|ipod/i.test(
      navigator.userAgent || navigator.platform || ""
    );
    setModifier(mac ? "⌘" : "Ctrl");
  }, []);

  if (isMobile) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Search"
      className={cn(
        "flex w-48 items-center justify-between gap-2 rounded-md px-3 py-1.5",
        "border border-line-strong bg-bg-panel",
        "font-sans text-[13px] text-fg-tertiary",
        "transition-colors duration-cd-fast ease-cd",
        "hover:border-line-strong hover:bg-bg-subtle hover:text-fg-secondary",
        focusRing
      )}
    >
      <span className="flex items-center gap-2">
        <Search
          aria-hidden="true"
          className="size-4 shrink-0 [stroke-width:1.8]"
        />
        Search
      </span>
      <span className="flex items-center gap-1">
        {/*
          Reserved before it is known, so the chip does not resize a beat after
          it mounts. `min-w` on Kbd already holds one character's worth.
        */}
        <Kbd>{modifier ?? ""}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
