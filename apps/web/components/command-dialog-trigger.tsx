"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search } from "lucide-react";

export function CommandDialogTrigger() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();
  const [shortcut, setShortcut] = React.useState<string>("");

  React.useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    setShortcut(isMac ? "⌘/" : "Ctrl+/");
  }, []);

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Search (${shortcut})`}
      className="flex items-center justify-between w-48 px-3 py-2 text-sm text-muted-foreground bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <span>Search</span>
      </span>
      {shortcut && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
