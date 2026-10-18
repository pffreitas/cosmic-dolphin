import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BookmarksAPI,
  type Bookmark,
  type CreateBookmarkParams,
} from "@/lib/api";
import { useAuth } from "./AuthContext";
import { cacheBookmarksInBackground } from "@/lib/bookmark-cache";
type Capture = {
  id: string;
  params: CreateBookmarkParams;
  status: "saving" | "failed" | "saved";
  bookmark?: Bookmark;
};
const Context = createContext<{
  captures: Capture[];
  revision: number;
  save: (params: CreateBookmarkParams) => void;
  retry: (id: string) => void;
  acknowledge: (ids: string[]) => void;
  invalidate: () => void;
}>({
  captures: [],
  revision: 0,
  save: () => {},
  retry: () => {},
  acknowledge: () => {},
  invalidate: () => {},
});
export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [revision, setRevision] = useState(0);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    setCaptures([]);
    setRevision(0);
  }, [user?.id]);
  const submit = async (capture: Capture) => {
    const userId = user?.id;
    if (!userId || inFlight.current.has(capture.id)) return;
    inFlight.current.add(capture.id);
    setCaptures((previous) =>
      previous.map((value) =>
        value.id === capture.id ? { ...value, status: "saving" } : value,
      ),
    );
    try {
      const result = await BookmarksAPI.create(capture.params);
      if (owner.current !== userId) return;
      cacheBookmarksInBackground(userId, [result.bookmark]);
      setCaptures((previous) =>
        previous.map((value) =>
          value.id === capture.id
            ? { ...value, status: "saved", bookmark: result.bookmark }
            : value,
        ),
      );
      setRevision((value) => value + 1);
    } catch {
      if (owner.current === userId)
        setCaptures((previous) =>
          previous.map((value) =>
            value.id === capture.id ? { ...value, status: "failed" } : value,
          ),
        );
    } finally {
      inFlight.current.delete(capture.id);
    }
  };
  const acknowledge = useCallback((ids: string[]) => {
    setCaptures((previous) => {
      const next = previous.filter(
        (capture) =>
          capture.status !== "saved" ||
          !capture.bookmark ||
          !ids.includes(capture.bookmark.id),
      );
      return next.length === previous.length ? previous : next;
    });
  }, []);
  const save = (params: CreateBookmarkParams) => {
    const capture: Capture = {
      id: `capture:${Date.now()}:${Math.random()}`,
      params,
      status: "saving",
    };
    setCaptures((previous) => [capture, ...previous]);
    void submit(capture);
  };
  return (
    <Context.Provider
      value={{
        captures,
        revision,
        acknowledge,
        invalidate: () => setRevision((value) => value + 1),
        save,
        retry: (id) => {
          const capture = captures.find((value) => value.id === id);
          if (capture) void submit(capture);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCaptures = () => useContext(Context);
