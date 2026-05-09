"use client";

import * as React from "react";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search } from "lucide-react";

export function CommandDialogTrigger() {
  const { toggle } = useCommandDialog();
  const isMobile = useIsMobile();
  const [isMac, setIsMac] = React.useState<boolean | null>(null);

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
      className="flex items-center justify-between w-48 px-3 py-2 text-sm text-muted-foreground bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-text"
    >
      <div className="flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <span>Search</span>
      </div>
      {isMac !== null && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <kbd className="font-sans px-1.5 py-0.5 rounded-md border bg-gray-50 border-gray-200">
            {isMac ? "⌘" : "Ctrl"}
          </kbd>
          <kbd className="font-sans px-1.5 py-0.5 rounded-md border bg-gray-50 border-gray-200">
            /
          </kbd>
        </span>
      )}
    </button>
  );
}
