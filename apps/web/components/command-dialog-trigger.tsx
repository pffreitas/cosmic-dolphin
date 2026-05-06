"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search } from "lucide-react";

export function CommandDialogTrigger() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  const [modifierKey, setModifierKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Determine modifier key based on OS (Mac vs Windows/Linux)
    const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    setModifierKey(isMac ? "⌘" : "Ctrl");
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label="Search"
      className="flex items-center justify-between w-48 px-3 py-2 text-sm text-muted-foreground bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-text"
    >
      <div className="flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <span>Search</span>
      </div>
      {modifierKey && (
        <span className="text-xs text-gray-400 font-mono">
          <kbd className="font-sans px-1 rounded-sm bg-gray-100 border border-gray-200">{modifierKey}</kbd>
          <span className="mx-0.5"></span>
          <kbd className="font-sans px-1 rounded-sm bg-gray-100 border border-gray-200">/</kbd>
        </span>
      )}
    </button>
  );
}
