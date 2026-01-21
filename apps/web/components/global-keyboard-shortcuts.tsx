"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";

export function GlobalKeyboardShortcuts() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();

  React.useEffect(() => {
    // Don't add keyboard shortcuts on mobile
    if (isMobile) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + / to toggle command dialog
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle, isMobile]);

  return null;
}
