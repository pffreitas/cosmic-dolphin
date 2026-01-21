"use client";

import * as React from "react";

interface CommandDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
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
  const [open, setOpen] = React.useState(false);

  const toggle = React.useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggle,
    }),
    [open, toggle]
  );

  return (
    <CommandDialogContext.Provider value={value}>
      {children}
    </CommandDialogContext.Provider>
  );
}
