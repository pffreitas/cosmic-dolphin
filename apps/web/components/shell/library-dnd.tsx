"use client";

import * as React from "react";

/**
 * Drag-to-refile across the app shell.
 *
 * The collection tree moved out of the Library page and into the sidebar, so
 * the rows being dragged (the Library list) and the places they are dropped
 * (the sidebar's collections) no longer share a parent component. This is the
 * seam between them: the Library publishes what is being carried and how to
 * refile it; the sidebar reads the first and calls the second.
 *
 * Outside the Library nothing registers a handler, so the sidebar's rows never
 * become drop targets — there is nothing on any other route to drag.
 */
type DropHandler = (ids: string[], collectionId: string | null) => void;

interface LibraryDndValue {
  /** Ids of the rows being dragged. Empty when nothing is in flight. */
  dragging: string[];
  setDragging: (ids: string[]) => void;
  /** Refile what is being carried into `collectionId` (`null` is Inbox). */
  drop: (collectionId: string | null) => void;
  canDrop: boolean;
  registerDropHandler: (handler: DropHandler | null) => void;
}

const LibraryDndContext = React.createContext<LibraryDndValue | null>(null);

export function LibraryDndProvider({ children }: { children: React.ReactNode }) {
  const [dragging, setDragging] = React.useState<string[]>([]);
  const [handler, setHandler] = React.useState<{ fn: DropHandler } | null>(null);

  // Stable, so a consumer can register from an effect without re-running it
  // every time the context value changes.
  const registerDropHandler = React.useCallback(
    (fn: DropHandler | null) => setHandler(fn ? { fn } : null),
    [],
  );

  const value = React.useMemo<LibraryDndValue>(
    () => ({
      dragging,
      setDragging,
      canDrop: Boolean(handler) && dragging.length > 0,
      drop: (collectionId) => {
        const ids = dragging;
        setDragging([]);
        if (ids.length && handler) handler.fn(ids, collectionId);
      },
      registerDropHandler,
    }),
    [dragging, handler, registerDropHandler],
  );

  return (
    <LibraryDndContext.Provider value={value}>{children}</LibraryDndContext.Provider>
  );
}

/**
 * Falls back to page-local state when there is no shell above — the dev
 * galleries and tests render the Library on its own.
 */
export function useLibraryDnd(): LibraryDndValue {
  const shared = React.useContext(LibraryDndContext);
  const [dragging, setDragging] = React.useState<string[]>([]);

  return (
    shared ?? {
      dragging,
      setDragging,
      canDrop: false,
      drop: () => setDragging([]),
      registerDropHandler: () => undefined,
    }
  );
}
