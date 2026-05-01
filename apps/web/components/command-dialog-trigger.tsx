"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search } from "lucide-react";

export function CommandDialogTrigger() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    // Check if the user is on a Mac to show the correct keyboard shortcut
    if (typeof window !== "undefined") {
      setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
    }
  }, []);

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      className="group flex items-center justify-between gap-2 w-48 px-3 py-2 text-sm text-muted-foreground bg-muted/50 border border-input rounded-lg hover:bg-muted/80 transition-colors cursor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      aria-label="Search (Command or Control + /)"
    >
      <div className="flex items-center gap-2">
        <Search size={16} className="text-muted-foreground" aria-hidden="true" />
        <span>Search</span>
      </div>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 transition-opacity group-hover:opacity-100">
        <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>/
      </kbd>
    </button>
  );
}
