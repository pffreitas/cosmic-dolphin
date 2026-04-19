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
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Search command (${isMac ? "⌘" : "Ctrl"} /)`}
      className="flex items-center justify-between w-48 px-3 py-2 text-sm text-muted-foreground bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-text"
    >
      <div className="flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <span>Search</span>
      </div>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
        <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>/
      </kbd>
    </button>
  );
}
