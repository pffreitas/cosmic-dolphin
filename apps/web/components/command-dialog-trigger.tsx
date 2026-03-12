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

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 w-48 px-3 py-2 text-sm text-muted-foreground bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-text"
      aria-label="Search (Cmd/Ctrl + /)"
    >
      <Search size={16} className="text-gray-400" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
        <span className="text-xs">⌘</span>/
      </kbd>
    </button>
  );
}
