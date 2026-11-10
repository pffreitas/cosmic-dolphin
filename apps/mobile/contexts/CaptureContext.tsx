import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { CreateBookmarkRequest } from "@cosmic-dolphin/api-client";
import type { Bookmark } from "@/lib/api";
import { MobileAPI } from "@/lib/mobile-api";
import { saveQueue, type SaveEntry } from "@/lib/save-queue";
import { useAuth } from "./AuthContext";
export type Capture = { id: string; entry: SaveEntry; status: "saving" | "queued" | "failed" | "saved"; bookmark?: Bookmark; alreadySaved?: boolean };
const Context = createContext<{
  captures: Capture[]; revision: number; changeError?: string;
  save: (params: CreateBookmarkRequest) => Promise<string>;
  confirm: (id: string, note: string, laterUntil: Date | null) => Promise<void>;
  drain: () => Promise<void>; retry: (id: string) => void; remove: (id: string) => void;
  updateBookmark: (id: string, bookmark: Bookmark) => void;
  acknowledge: (ids: string[]) => void; invalidate: () => void;
}>({ captures: [], revision: 0, save: async () => "", confirm: async () => {}, drain: async () => {}, retry: () => {}, remove: () => {}, updateBookmark: () => {}, acknowledge: () => {}, invalidate: () => {} });
export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [revision, setRevision] = useState(0);
  const [changeError, setChangeError] = useState<string>();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const accepted = useRef(new Map<string, Bookmark>());
  const lifetime = useRef(new AbortController());
  const drain = useCallback(async () => {
    const userId = owner.current;
    const signal = lifetime.current.signal;
    if (!userId || signal.aborted) return;
    const entries = await saveQueue.list();
    if (signal.aborted) return;
    setCaptures(previous => {
      const saved = previous.filter(capture => capture.status === "saved");
      return [...entries.filter(entry => !entry.userId || entry.userId === userId).reverse().map(entry => ({ id: entry.id, entry, status: entry.failure === "retry" || entry.failure === "rejected" ? "failed" as const : "queued" as const })), ...saved];
    });
    if (!entries.some(entry => !entry.userId || entry.userId === userId)) return;
    await saveQueue.drain(userId, MobileAPI, {
      signal,
      onAccepting: (entry, bookmark) => { if (!signal.aborted) accepted.current.set(entry.id, bookmark); },
      onConfirmationFailure: () => { if (!signal.aborted) setChangeError("Change was not saved. Check your connection."); },
      onStatus: (entry, status, bookmark, alreadySaved) => {
        if (signal.aborted || owner.current !== userId) return;
        if (bookmark) accepted.current.set(entry.id, bookmark);
        setCaptures(previous => previous.map(value => value.id === entry.id ? { id: entry.id, entry, status, bookmark, alreadySaved } : value));
        if (status === "saved") setRevision(value => value + 1);
      },
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    accepted.current.clear();
    setCaptures([]);
    setChangeError(undefined);
    void drain().catch(() => {});
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void drain().catch(() => {}); });
    return () => { controller.abort(); subscription.remove(); };
  }, [user?.id, drain]);
  const acknowledge = useCallback((ids: string[]) => {
    setCaptures(previous => {
      const next = previous.filter(capture => capture.status !== "saved" || !capture.bookmark || capture.bookmark.processingStatus === "processing" || !ids.includes(capture.bookmark.id));
      return next.length === previous.length ? previous : next;
    });
  }, []);
  const updateBookmark = useCallback((id: string, bookmark: Bookmark) => {
    if (bookmark.userId !== owner.current) return;
    accepted.current.set(id, bookmark);
    setCaptures(previous => previous.map(value => value.id === id ? { ...value, bookmark } : value));
    if (bookmark.processingStatus !== "processing") setRevision(value => value + 1);
  }, []);
  const save = async (params: CreateBookmarkRequest) => {
    setChangeError(undefined);
    const userId = owner.current;
    const entry = await saveQueue.enqueue(params, userId);
    if (owner.current === userId) {
      setCaptures(previous => [{ id: entry.id, entry, status: "queued" }, ...previous]);
      void drain().catch(() => {});
    }
    return entry.id;
  };
  const confirm = async (id: string, note: string, laterUntil: Date | null) => {
    setChangeError(undefined);
    const userId = owner.current;
    const entry = await saveQueue.confirm(id, { note, laterUntil: laterUntil?.toISOString() ?? null }, userId);
    if (entry) { setCaptures(previous => previous.map(value => value.id === id ? { ...value, entry } : value)); return; }
    const bookmark = accepted.current.get(id);
    if (!userId || !bookmark || bookmark.userId !== userId) throw new Error("Capture is unavailable");
    // Actions are never queued. Restore the accepted value if the PATCH fails.
    setCaptures(previous => previous.map(value => value.id === id ? { ...value, bookmark: { ...bookmark, userNote: note, laterUntil: laterUntil?.toISOString() ?? null } } : value));
    try {
      const updated = await MobileAPI.update(bookmark.id, { userNote: note, laterUntil }, lifetime.current.signal, userId);
      if (owner.current !== userId) return;
      accepted.current.set(id, updated);
      setCaptures(previous => previous.map(value => value.id === id ? { ...value, bookmark: updated } : value));
      setRevision(value => value + 1);
    } catch (error) {
      if (owner.current === userId) setCaptures(previous => previous.map(value => value.id === id ? { ...value, bookmark } : value));
      throw error;
    }
  };
  const remove = async (id: string) => {
    await saveQueue.remove(id);
    setCaptures(previous => previous.filter(value => value.id !== id));
  };
  return <Context.Provider value={{ captures, revision, changeError, acknowledge, save, confirm, drain, updateBookmark,
    invalidate: () => setRevision(value => value + 1),
    retry: () => { void drain().catch(() => {}); }, remove: id => { void remove(id).catch(() => {}); },
  }}>{children}</Context.Provider>;
}
export const useCaptures = () => useContext(Context);
