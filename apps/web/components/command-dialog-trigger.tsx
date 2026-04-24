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
    // Check if the user is on a Mac to show the correct shortcut key
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
      className="flex items-center gap-2 w-48 px-3 py-2 text-sm text-muted-foreground bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-text group"
      aria-label="Search (Keyboard shortcut: Command or Control plus forward slash)"
    >
      <Search size={16} className="text-gray-400" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] font-medium text-gray-500 opacity-100 transition-opacity group-hover:opacity-100">
        <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span> /
      </kbd>
    </button>
  );
}
