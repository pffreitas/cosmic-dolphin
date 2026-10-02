"use client";

import * as React from "react";

interface CommandDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /**
   * Opens the palette with its input already holding `query`.
   *
   * The header omnibox's escalation path: the reader has typed something,
   * pressed ⌘K a second time, and wants everything the palette can do with
   * it — collections, people, navigation. Retyping it would be the palette
   * charging a toll for being one keystroke further away.
   */
  openWith: (query: string) => void;
  /** What the palette's input starts with when it next opens. */
  seed: string;
}

const CommandDialogContext =
  React.createContext<CommandDialogContextType | null>(null);

export function useCommandDialog() {
  const context = React.useContext(CommandDialogContext);
  if (!context) {
    throw new Error(
      "useCommandDialog must be used within a CommandDialogProvider"
    );
  }
  return context;
}

interface CommandDialogProviderProps {
  children: React.ReactNode;
}

export function CommandDialogProvider({
  children,
}: CommandDialogProviderProps) {
  const [open, setOpenState] = React.useState(false);
  const [seed, setSeed] = React.useState("");

  // A seed is for one opening. Closing clears it, so the next plain ⌘K does
  // not resurrect a query the reader already walked away from.
  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setSeed("");
  }, []);

  const toggle = React.useCallback(() => setOpen(!open), [open, setOpen]);

  const openWith = React.useCallback((query: string) => {
    setSeed(query);
    setOpenState(true);
  }, []);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      openWith,
      seed,
    }),
    [open, setOpen, toggle, openWith, seed]
  );

  return (
    <CommandDialogContext.Provider value={value}>
      {children}
    </CommandDialogContext.Provider>
  );
}
