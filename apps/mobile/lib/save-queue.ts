import { pendingShares, type PendingShare, type ShareQueueReader } from "../modules/share-queue";
import { saveRequest } from "./save-request";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import type { Bookmark } from "./api";
import type { CapturePlatform, CaptureSource, CreateBookmarkRequest } from "@cosmic-dolphin/api-client";

export type SaveEntry = {
  id: string;
  url: string;
  isPrivateLink?: boolean;
  title?: string;
  description?: string;
  captureSource: CaptureSource;
  capturePlatform: CapturePlatform;
  userId?: string;
  queuedAt: string;
  attempts: number;
  notBefore?: string;
  failure?: "rejected" | "retry" | "auth";
  note?: string;
  laterUntil?: string | null;
};
const KEY = "save-queue:v1";
// All read/modify/write operations share one lane, including separate providers.
let mutations: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutations.then(operation);
  mutations = result.catch(() => {});
  return result;
}
async function read(): Promise<SaveEntry[]> {
  const stored = await AsyncStorage.getItem(KEY);
  return stored ? JSON.parse(stored) : [];
}
type QueueClient = {
  update?: (id: string, params: { userNote?: string; laterUntil?: Date | null }, signal?: AbortSignal, userId?: string) => Promise<Bookmark>;
  create: (params: CreateBookmarkRequest, signal?: AbortSignal, userId?: string) => Promise<{ bookmark: Bookmark; alreadySaved?: boolean }> };
export type QueueDrainOptions = {
  onlyUnattempted?: boolean;
  signal?: AbortSignal;
  onStatus?: (entry: SaveEntry, status: "saving" | "queued" | "failed" | "saved", bookmark?: Bookmark, alreadySaved?: boolean) => void;
  onAccepting?: (entry: SaveEntry, bookmark: Bookmark) => void;
  onConfirmationFailure?: () => void;
};
let drains: Promise<unknown> = Promise.resolve();
export const saveQueue = {
  importShares(bridge: ShareQueueReader | null = pendingShares()): Promise<string[]> {
    return serialized(async () => {
      if (!bridge) return [];
      const snapshot: PendingShare[] = JSON.parse(await bridge.readPendingShares());
      const entries = await read();
      for (const entry of snapshot) {
        if (!entries.some(existing => existing.id === entry.id)) entries.push({ id: entry.id, url: entry.url, userId: entry.userId, queuedAt: entry.queuedAt, notBefore: entry.notBefore,
          captureSource: "ios_share_extension", capturePlatform: "ios", attempts: 0 });
      }
      if (!snapshot.length) return [];
      await AsyncStorage.setItem(KEY, JSON.stringify(entries));
      const ids = snapshot.map(entry => entry.id);
      await bridge.removePendingShares(ids);
      return ids;
    });
  },
  drain(userId: string, client: QueueClient, options: QueueDrainOptions = {}) {
    const result = drains.then(async () => {
      for (const queued of await saveQueue.list()) {
        let entry: SaveEntry | undefined = queued;
        if (options.signal?.aborted) break;
        if ((options.onlyUnattempted && entry.attempts > 0) || (entry.userId && entry.userId !== userId) || entry.failure === "rejected" || (entry.notBefore && Date.parse(entry.notBefore) > Date.now())) continue;
        entry = await serialized(async () => {
          const entries = await read();
          const current = entries.find(value => value.id === queued.id);
          if (!current) return undefined;
          current.userId = userId;
          current.attempts++;
          if (current.laterUntil && Date.parse(current.laterUntil) <= Date.now()) current.laterUntil = null;
          await AsyncStorage.setItem(KEY, JSON.stringify(entries));
          return current;
        });
        if (!entry || options.signal?.aborted) continue;
        options.onStatus?.(entry, "saving");
        try {
          const result = await saveRequest(signal => client.create(createRequest(entry!), signal, userId), options.signal);
          if (options.signal?.aborted) break;
          if (result.bookmark.userId !== userId) throw { response: new Response(null, { status: 401 }) };
          const latest = await saveQueue.accept(entry.id, () => options.onAccepting?.(entry!, result.bookmark));
          if (latest && (latest.note !== entry.note || latest.laterUntil !== entry.laterUntil)) {
            try {
              if (!client.update) throw new Error("Confirmation update unavailable");
              result.bookmark = await client.update(result.bookmark.id, { userNote: latest.note, laterUntil: latest.laterUntil == null ? latest.laterUntil : new Date(latest.laterUntil) }, options.signal, userId);
            } catch { options.onConfirmationFailure?.(); }
          }
          options.onStatus?.(latest ?? entry, "saved", result.bookmark, result.alreadySaved);
        } catch (error: unknown) {
          if (options.signal?.aborted) break;
          const status = (error as { response?: Response }).response?.status;
          if (status === 401) { const changed = await saveQueue.patch(entry.id, { failure: "auth" }); if (changed) options.onStatus?.(changed, "queued"); break; }
          if (status === 429) {
            const header = (error as { response: Response }).response.headers.get("Retry-After") ?? "60";
            const time = /^\d+$/.test(header) ? Date.now() + Number(header) * 1000 : Date.parse(header);
            const changed = await saveQueue.patch(entry.id, { notBefore: new Date(Number.isFinite(time) ? time : Date.now() + 60000).toISOString(), failure: undefined });
            if (changed) options.onStatus?.(changed, "queued");
            continue;
          }
          const changed = await saveQueue.patch(entry.id, { failure: status === 400 ? "rejected" : "retry" });
          if (changed) options.onStatus?.(changed, "failed");
        }
      }
    });
    drains = result.catch(() => {});
    return result;
  },
  list: () => serialized(read),
  enqueue(params: CreateBookmarkRequest, userId?: string, delivery?: { id: string; queuedAt: string }) {
    return serialized(async () => {
      const entries = await read();
      const existing = delivery && entries.find(entry => entry.id === delivery.id);
      if (existing) return existing;
      const entry: SaveEntry = {
        id: delivery?.id ?? randomUUID(), url: params.sourceUrl, userId,
        isPrivateLink: params.isPrivateLink, title: params.title, description: params.description,
        captureSource: params.captureSource!, capturePlatform: params.capturePlatform!,
        queuedAt: delivery?.queuedAt ?? new Date().toISOString(), attempts: 0,
        note: params.userNote, laterUntil: params.laterUntil == null ? params.laterUntil : params.laterUntil.toISOString(),
      };
      await AsyncStorage.setItem(KEY, JSON.stringify([...entries, entry]));
      return entry;
    });
  },
  patch(id: string, fields: Partial<SaveEntry>) {
    return serialized(async () => {
      const entries = await read();
      const entry = entries.find(value => value.id === id);
      if (!entry) return undefined;
      Object.assign(entry, fields);
      await AsyncStorage.setItem(KEY, JSON.stringify(entries));
      return entry;
    });
  },
  confirm(id: string, fields: { note: string; laterUntil: string | null }, userId?: string) {
    return serialized(async () => {
      const entries = await read();
      const entry = entries.find(value => value.id === id);
      if (!entry) return undefined;
      if (entry.userId && entry.userId !== userId) throw new Error("Capture belongs to another account");
      Object.assign(entry, fields);
      await AsyncStorage.setItem(KEY, JSON.stringify(entries));
      return entry;
    });
  },
  accept(id: string, onAccepted: () => void) {
    return serialized(async () => {
      const entries = await read();
      const entry = entries.find(value => value.id === id);
      onAccepted();
      await AsyncStorage.setItem(KEY, JSON.stringify(entries.filter(value => value.id !== id)));
      return entry;
    });
  },
  remove(id: string) {
    return serialized(async () => {
      await AsyncStorage.setItem(KEY, JSON.stringify((await read()).filter(entry => entry.id !== id)));
    });
  },
};
export function createRequest(entry: SaveEntry): CreateBookmarkRequest {
  return { sourceUrl: entry.url, isPrivateLink: entry.isPrivateLink,
    title: entry.title, description: entry.description, userNote: entry.note,
    laterUntil: entry.laterUntil == null ? entry.laterUntil : new Date(entry.laterUntil),
    captureSource: entry.captureSource, capturePlatform: entry.capturePlatform,
    queuedAt: new Date(entry.queuedAt) };
}
