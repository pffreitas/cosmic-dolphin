import { useMemo, useSyncExternalStore, useCallback, useEffect } from "react";
import { AppState, AccessibilityInfo } from "react-native";
import { useFocusEffect } from "expo-router";
import type { Bookmark, FeedItem } from "@cosmic-dolphin/api-client";
import { MobileAPI } from "./mobile-api";
import { readWhen, restoreLater, backTimeCopy } from "./read-when";
import { nextReadingSequence } from "./reading-sequence";

interface ActionState {
  changes: Record<string, Partial<Bookmark>>;
  hidden: Record<string, boolean>;
  toast?: { message: string; undo?: () => void };
}
/** In-memory intentions; the server owns the pick snapshot. Shared with the reader. */
export class BookmarkActions {
  private state: ActionState = { changes: {}, hidden: {} };
  private active = true;
  private screenReader = false;
  private timer?: ReturnType<typeof setTimeout>;
  private toastId = 0;
  private versions = new Map<string, number>();
  private requestId = 0;
  private confirmedPlacement = new Map<string, Pick<Bookmark, "collectionId" | "collectionPath">>();
  private confirmedArchive = new Map<string, boolean>();
  private confirmedLater = new Map<string, Date | null>();
  private confirmedRead = new Map<string, Date | undefined>();
  private confirmedNote = new Map<string, string | null>();
  private pending = new Map<string, Promise<unknown>>();
  private changedSequence = new Map<string, number>();
  private deferred?: () => void;
  private listeners = new Set<() => void>();
  constructor(private userId?: string) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private publish(state: ActionState) { if (!this.active) return; this.state = state; this.listeners.forEach(listener => listener()); }
  private request(operation: () => Promise<unknown>, rollback: () => void, key: string, accepted?: () => void) {
    if (!this.active) return;
    const version = (this.versions.get(key) ?? 0) + 1; this.versions.set(key, version);
    const id = ++this.requestId;
    const bookmarkId = key.split(":")[0];
    this.changedSequence.set(bookmarkId, nextReadingSequence());
    const prior = this.pending.get(bookmarkId) ?? Promise.resolve();
    const job = prior.then(() => this.active ? operation() : undefined).then(() => {
      this.changedSequence.set(bookmarkId, nextReadingSequence());
      if (this.active) accepted?.();
    }).catch(() => {
      this.changedSequence.set(bookmarkId, nextReadingSequence());
      if (!this.active || this.versions.get(key) !== version) return;
      const latest = id === this.requestId; rollback(); if (latest) this.showToast("Change was not saved. Check your connection.");
    });
    this.pending.set(bookmarkId, job);
    void job.finally(() => { if (this.pending.get(bookmarkId) === job) this.pending.delete(bookmarkId); });
  }
  private showToast(message: string, undo?: () => void) {
    this.closeToast();
    const id = ++this.toastId;
    const deadline = Date.now() + 8000;
    const guardedUndo = undo ? () => {
      if (id !== this.toastId || Date.now() >= deadline) return;
      clearTimeout(this.timer); this.deferred = undefined; ++this.toastId; undo();
    } : undefined;
    this.publish({ ...this.state, toast: { message, undo: guardedUndo } });
    this.timer = setTimeout(() => { if (id === this.toastId) {
      const message = this.state.toast?.message;
      this.closeToast();
      if (this.screenReader && message) this.publish({ ...this.state, toast: { message } });
    } }, 8000);
  }
  setScreenReader = (enabled: boolean) => { this.screenReader = enabled; };
  closeToast = () => {
    clearTimeout(this.timer); ++this.toastId;
    const flush = this.deferred; this.deferred = undefined;
    this.publish({ ...this.state, toast: undefined }); flush?.();
  };
  dispose = () => { clearTimeout(this.timer); this.deferred = undefined; ++this.toastId; this.active = false; this.listeners.clear(); };
  background = () => { this.closeToast(); };
  navigationAway = () => { this.closeToast(); };
  view = (bookmark: Bookmark): Bookmark => ({ ...bookmark, ...this.state.changes[bookmark.id] });
  synchronize = (bookmarks: Bookmark[], readSequence = Infinity) => {
    const changes = { ...this.state.changes }; const hidden = { ...this.state.hidden }; let changed = false;
    for (const bookmark of bookmarks) {
      if (!this.owns(bookmark) || this.pending.has(bookmark.id) || readSequence <= (this.changedSequence.get(bookmark.id) ?? -Infinity)) continue;
      if (changes[bookmark.id] || hidden[bookmark.id]) changed = true;
      delete changes[bookmark.id]; delete hidden[bookmark.id];
      this.confirmedRead.set(bookmark.id, bookmark.readAt);
      this.confirmedNote.set(bookmark.id, bookmark.userNote ?? null);
      this.confirmedLater.set(bookmark.id, bookmark.laterUntil ?? null);
      this.confirmedArchive.set(bookmark.id, bookmark.isArchived ?? false);
      this.confirmedPlacement.set(bookmark.id, { collectionId: bookmark.collectionId, collectionPath: bookmark.collectionPath });
    }
    if (changed) this.publish({ ...this.state, changes, hidden });
  };
  isVisible = (item: FeedItem) => {
    const b = item.bookmark;
    if (!b) return true;
    if (this.state.hidden[b.id]) return false;
    const own = item.type === "own_save" || item.type === "pending";
    const value = this.view(b);
    return !own || (!value.isArchived && (!value.laterUntil || value.laterUntil.getTime() <= Date.now()));
  };
  reject = (item: FeedItem) => {
    const b = item.bookmark;
    if (!b) return;
    const own = item.type === "own_save" || item.type === "pending";
    if (own && !this.owns(b)) return;
    const prior = this.view(b).isArchived ?? false;
    if (!this.confirmedArchive.has(b.id)) this.confirmedArchive.set(b.id, prior);
    let archiveAccepted = false;
    const apply = (hidden: boolean, isArchived: boolean) => this.publish({ ...this.state,
      hidden: { ...this.state.hidden, [b.id]: hidden },
      changes: { ...this.state.changes, [b.id]: { ...this.state.changes[b.id], ...(own ? { isArchived } : {}) } },
    });
    apply(true, true);
    if (own) this.request(() => MobileAPI.update(b.id, { isArchived: true }, undefined, this.userId), () => { this.deferred = undefined; apply(false, prior); }, `${b.id}:archive`, () => { archiveAccepted = true; this.confirmedArchive.set(b.id, true); });
    this.showToast("Archived. Cosmic won't pick it again.", () => {
      apply(false, prior); this.publish({ ...this.state, toast: undefined });
      if (own) this.request(() => MobileAPI.update(b.id, { isArchived: prior }, undefined, this.userId), () => { const archived = this.confirmedArchive.get(b.id) ?? false; apply(archived, archived); }, `${b.id}:archive`, () => this.confirmedArchive.set(b.id, prior));
    });
    this.deferred = () => this.request(() => {
      if (own && !archiveAccepted) return Promise.reject(new Error("Archive was not saved"));
      return MobileAPI.notInterested(b.id, this.userId);
    }, () => {
      apply(false, prior);
      if (own && archiveAccepted) this.request(() => MobileAPI.update(b.id, { isArchived: prior }, undefined, this.userId), () => { const archived = this.confirmedArchive.get(b.id) ?? false; apply(archived, archived); }, `${b.id}:archive`, () => this.confirmedArchive.set(b.id, prior));
    }, `${b.id}:archive`);
  };
  owns = (bookmark: Bookmark) => this.active && !!this.userId && bookmark.userId === this.userId;
  move = (bookmark: Bookmark, collectionId?: string, topic = "Inbox") => {
    if (!this.owns(bookmark)) return;
    const current = this.view(bookmark);
    const prior = { collectionId: current.collectionId, collectionPath: current.collectionPath };
    const desired = { collectionId, collectionPath: collectionId ? [{ id: collectionId, name: topic }] : [] };
    if (!this.confirmedPlacement.has(bookmark.id)) this.confirmedPlacement.set(bookmark.id, prior);
    const apply = (placement: Pick<Bookmark, "collectionId" | "collectionPath">) => this.publish({ ...this.state,
      changes: { ...this.state.changes, [bookmark.id]: { ...this.state.changes[bookmark.id], ...placement } },
    });
    apply(desired);
    this.request(() => MobileAPI.refile(bookmark.id, collectionId, this.userId), () => apply(this.confirmedPlacement.get(bookmark.id)!), `${bookmark.id}:move`, () => this.confirmedPlacement.set(bookmark.id, desired));
    this.showToast(`Moved to ${topic}. Cosmic won't move it again.`, () => {
      apply(prior); this.publish({ ...this.state, toast: undefined });
      this.request(() => MobileAPI.refile(bookmark.id, prior.collectionId, this.userId), () => apply(this.confirmedPlacement.get(bookmark.id)!), `${bookmark.id}:move`, () => this.confirmedPlacement.set(bookmark.id, prior));
    });
  };
  note = (bookmark: Bookmark, userNote: string | null) => {
    if (!this.owns(bookmark) || (userNote?.length ?? 0) > 500) return;
    const prior = this.view(bookmark).userNote ?? null;
    if (!this.confirmedNote.has(bookmark.id)) this.confirmedNote.set(bookmark.id, prior);
    const apply = (value: string | null) => this.publish({ ...this.state,
      changes: { ...this.state.changes, [bookmark.id]: { ...this.state.changes[bookmark.id], userNote: value } },
    });
    apply(userNote);
    this.request(() => MobileAPI.update(bookmark.id, { userNote }, undefined, this.userId), () => apply(this.confirmedNote.get(bookmark.id)!), `${bookmark.id}:note`, () => this.confirmedNote.set(bookmark.id, userNote));
    this.showToast(userNote ? "Note saved" : "Note cleared");
  };
  save = (item: FeedItem) => {
    if (!item.bookmark || (item.type !== "followed_save" && item.type !== "reshare")) return;
    this.showToast("Saved to Cosmic Dolphin");
    this.request(() => MobileAPI.saveRecommendation(item.bookmark!.id, this.userId), () => {}, `${item.bookmark.id}:save`);
  };
  done = (bookmark: Bookmark, done = !this.view(bookmark).readAt) => {
    if (!this.owns(bookmark)) return;
    const prior = this.view(bookmark).readAt;
    if (!this.confirmedRead.has(bookmark.id)) this.confirmedRead.set(bookmark.id, prior);
    const desired = done ? new Date() : undefined;
    const apply = (readAt?: Date) => this.publish({ ...this.state, changes: { ...this.state.changes, [bookmark.id]: { ...this.state.changes[bookmark.id], readAt } } });
    apply(desired);
    this.request(() => MobileAPI.read(bookmark.id, done, this.userId), () => apply(this.confirmedRead.get(bookmark.id)), `${bookmark.id}:read`, () => this.confirmedRead.set(bookmark.id, desired));
    this.showToast(done ? "Marked done" : "Marked not done", () => {
      apply(prior); this.publish({ ...this.state, toast: undefined });
      this.request(() => MobileAPI.read(bookmark.id, !!prior, this.userId), () => apply(this.confirmedRead.get(bookmark.id)), `${bookmark.id}:read`, () => this.confirmedRead.set(bookmark.id, prior));
    });
  };
  later = (bookmark: Bookmark, when = readWhen("Tonight")!) => {
    if (!this.owns(bookmark)) return;
    const prior = this.view(bookmark).laterUntil ?? null;
    if (!this.confirmedLater.has(bookmark.id)) this.confirmedLater.set(bookmark.id, prior);
    const apply = (laterUntil: Date | null) => this.publish({ ...this.state, changes: { ...this.state.changes, [bookmark.id]: { ...this.state.changes[bookmark.id], laterUntil } } });
    apply(when);
    this.request(() => MobileAPI.update(bookmark.id, { laterUntil: when }, undefined, this.userId), () => apply(restoreLater(this.confirmedLater.get(bookmark.id))), `${bookmark.id}:later`, () => this.confirmedLater.set(bookmark.id, when));
    this.showToast(`Back ${backTimeCopy(when)}`, () => {
      const restored = restoreLater(prior);
      apply(restored); this.publish({ ...this.state, toast: undefined });
      this.request(() => MobileAPI.update(bookmark.id, { laterUntil: restored }, undefined, this.userId), () => apply(restoreLater(this.confirmedLater.get(bookmark.id))), `${bookmark.id}:later`, () => this.confirmedLater.set(bookmark.id, restored));
    });
  };
}
export function useBookmarkActions(userId?: string) {
  const controller = useMemo(() => new BookmarkActions(userId), [userId]);
  useFocusEffect(useCallback(() => () => controller.navigationAway(), [controller]));
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(controller.setScreenReader).catch(() => {});
    const accessibility = AccessibilityInfo.addEventListener("screenReaderChanged", controller.setScreenReader);
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") controller.background(); });
    return () => { subscription.remove(); accessibility.remove(); controller.dispose(); };
  }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { controller, state };
}
