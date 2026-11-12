import { BookmarkActions } from "../bookmark-actions";
import { BookmarkFromJSON, type Bookmark } from "@cosmic-dolphin/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "fictional-token", user: { id: "reader" } } } }) } } }));
jest.mock("../bookmark-cache", () => ({ cacheBookmarksInBackground: jest.fn() }));
const originalFetch = global.fetch;
const json = (extra = {}) => ({ id: "one", userId: "reader", title: "Fictional one", sourceUrl: "https://one.example", createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z", isArchived: false, processingStatus: "completed", ...extra });
const bookmark = (extra = {}): Bookmark => BookmarkFromJSON(json(extra));
const response = (extra = {}) => new Response(JSON.stringify(json(extra)), { status: 200 });
let writes: { path: string; method?: string; body?: string }[];
let mutation: (path: string, init?: RequestInit) => Promise<Response>;
let controller: BookmarkActions;
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
beforeEach(async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-11-11T10:00:00Z"));
  await AsyncStorage.clear(); writes = [];
  mutation = async () => response();
  const fetcher = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(input as string, "https://fixture.invalid").pathname;
    writes.push({ path, method: init?.method, body: init?.body as string }); return mutation(path, init);
  });
  global.fetch = Object.assign(fetcher, { preconnect: originalFetch.preconnect });
  controller = new BookmarkActions("reader");
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); global.fetch = originalFetch; });
it("Undo is available before 8s, expires exactly at 8s and cannot send after expiry", async () => {
  const b = bookmark(); controller.done(b); await settle();
  jest.advanceTimersByTime(7999); expect(controller.getSnapshot().toast?.undo).toBeDefined();
  const expired = controller.getSnapshot().toast!.undo!;
  jest.advanceTimersByTime(1); expect(controller.getSnapshot().toast).toBeUndefined();
  expired(); await settle(); expect(writes).toHaveLength(1); expect(controller.view(b).readAt).toBeDefined();
});
it("Not for me archives an own save immediately; Undo restores it and sends no feedback", async () => {
  const b = bookmark(); const item = { type: "own_save" as const, bookmark: b };
  controller.reject(item);
  expect(controller.isVisible(item)).toBe(false); await settle();
  expect(writes).toEqual([{ path: "/api/v1/bookmarks/one", method: "PATCH", body: JSON.stringify({ isArchived: true }) }]);
  expect(controller.getSnapshot().toast?.message).toBe("Archived. Cosmic won't pick it again.");
  jest.advanceTimersByTime(4000); controller.getSnapshot().toast!.undo!(); await settle();
  expect(controller.isVisible(item)).toBe(true);
  expect(JSON.parse(writes[1].body!)).toEqual({ isArchived: false });
  jest.advanceTimersByTime(20000); await settle();
  expect(writes.some(write => write.path.endsWith("/feedback"))).toBe(false);
});
it("closing the rejection toast sends exactly one deferred not_interested, after the immediate archive", async () => {
  controller.reject({ type: "own_save", bookmark: bookmark() }); await settle();
  expect(writes).toHaveLength(1);
  controller.closeToast(); await settle();
  expect(writes[1]).toEqual({ path: "/api/v1/feed/feedback", method: "POST", body: JSON.stringify({ kind: "not_interested", bookmarkId: "one" }) });
  controller.closeToast(); jest.advanceTimersByTime(8000); await settle(); expect(writes).toHaveLength(2);
});
it("rejection expiry sends feedback once at 8s, never at 7999ms", async () => {
  controller.reject({ type: "own_save", bookmark: bookmark() }); await settle();
  jest.advanceTimersByTime(7999); await settle(); expect(writes).toHaveLength(1);
  jest.advanceTimersByTime(1); await settle(); expect(writes.filter(write => write.path.endsWith("/feedback"))).toHaveLength(1);
});
it("navigation away flushes deferred feedback and closes the Undo window", async () => {
  controller.reject({ type: "own_save", bookmark: bookmark() }); await settle();
  const undo = controller.getSnapshot().toast!.undo!;
  controller.navigationAway(); undo(); await settle();
  expect(controller.getSnapshot().toast).toBeUndefined();
  expect(writes.filter(write => write.path.endsWith("/feedback"))).toHaveLength(1);
  expect(writes.filter(write => write.method === "PATCH")).toHaveLength(1);
});
it("background flushes deferred feedback once and disables Undo", async () => {
  controller.reject({ type: "own_save", bookmark: bookmark() }); await settle();
  controller.background(); controller.background(); await settle();
  expect(writes.filter(write => write.path.endsWith("/feedback"))).toHaveLength(1);
  expect(controller.getSnapshot().toast?.undo).toBeUndefined();
});
it("process disposal loses only deferred feedback, keeps the accepted archive, and stores no durable action queue", async () => {
  const item = { type: "own_save" as const, bookmark: bookmark() };
  controller.reject(item); await settle(); controller.dispose();
  jest.advanceTimersByTime(20000); await settle();
  expect(writes).toHaveLength(1); expect(JSON.parse(writes[0].body!)).toEqual({ isArchived: true });
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  const relaunched = new BookmarkActions("reader");
  expect(relaunched.isVisible({ ...item, bookmark: bookmark({ isArchived: true }) })).toBe(false);
  expect(relaunched.getSnapshot().toast).toBeUndefined();
});
it.each(["followed_save", "reshare"] as const)("%s Undo sends nothing, never archives, and killing before feedback may show it again", async type => {
  const item = { type, bookmark: bookmark({ userId: "other" }) };
  controller.reject(item); expect(controller.isVisible(item)).toBe(false);
  controller.getSnapshot().toast!.undo!(); await settle(); expect(writes).toEqual([]);
  controller.reject(item); controller.dispose(); jest.advanceTimersByTime(8000); await settle();
  expect(writes).toEqual([]); expect(new BookmarkActions("reader").isVisible(item)).toBe(true);
});
it.each(["followed_save", "reshare"] as const)("%s commits only feedback at expiry and never calls owner PATCH", async type => {
  controller.reject({ type, bookmark: bookmark({ userId: "other" }) }); await settle(); expect(writes).toEqual([]);
  jest.advanceTimersByTime(8000); await settle();
  expect(writes).toEqual([{ path: "/api/v1/feed/feedback", method: "POST", body: JSON.stringify({ kind: "not_interested", bookmarkId: "one" }) }]);
});
it("a newer Done after Undo survives a delayed failure of the first request and keeps its latest status", async () => {
  let fail!: (error: Error) => void;
  let first = true;
  mutation = () => { if (first) { first = false; return new Promise((_resolve, reject) => { fail = reject; }); } return Promise.resolve(response({ readAt: "2026-11-11T10:00:01Z" })); };
  const b = bookmark(); controller.done(b); await settle();
  controller.getSnapshot().toast!.undo!(); controller.done(b); await settle();
  fail(new TypeError("old offline response")); await settle();
  expect(controller.view(b).readAt).toBeDefined();
  expect(controller.getSnapshot().toast?.message).toBe("Marked done");
});
it("Undo while Done is pending restores the UI immediately and sends in order so a late accepted read cannot overwrite unread", async () => {
  let accept!: (value: Response) => void;
  let read = false;
  mutation = async (_path, init) => {
    if (init?.method === "PUT") { const result = await new Promise<Response>(resolve => { accept = resolve; }); read = true; return result; }
    read = false; return response();
  };
  const b = bookmark(); controller.done(b); await settle(); controller.getSnapshot().toast!.undo!();
  expect(controller.view(b).readAt).toBeUndefined(); await settle();
  expect(writes).toHaveLength(1);
  accept(response({ readAt: "2026-11-11T10:00:00Z" })); await settle();
  expect(writes.map(write => write.method)).toEqual(["PUT", "DELETE"]);
  expect(read).toBe(false); expect(controller.view(b).readAt).toBeUndefined();
});
it("if both pending Done and Undo fail, rollback uses confirmed unread rather than the failed optimistic read", async () => {
  let fail!: (error: Error) => void; let first = true;
  mutation = async () => { if (first) { first = false; return new Promise((_resolve, reject) => { fail = reject; }); } throw new TypeError("Undo offline"); };
  const b = bookmark(); controller.done(b); await settle(); controller.getSnapshot().toast!.undo!();
  fail(new TypeError("Done offline")); await settle();
  expect(controller.view(b).readAt).toBeUndefined();
  expect(controller.getSnapshot().toast?.message).toBe("Change was not saved. Check your connection.");
});
it("a superseded Later request cannot restore over a newer snooze, including after an older error", async () => {
  let fail!: (error: Error) => void; let first = true;
  mutation = async () => { if (first) { first = false; return new Promise((_resolve, reject) => { fail = reject; }); } return response(); };
  const b = bookmark(); const tonight = new Date(Date.now() + 3600000); const tomorrow = new Date(Date.now() + 86400000);
  controller.later(b, tonight); await settle(); controller.later(b, tomorrow);
  fail(new TypeError("old Later")); await settle();
  expect(controller.view(b).laterUntil).toEqual(tomorrow);
  expect(writes.map(write => JSON.parse(write.body!).laterUntil)).toEqual([tonight.toISOString(), tomorrow.toISOString()]);
});
it("if Later and its pending Undo both fail, the confirmed prior snooze is restored rather than the failed new snooze", async () => {
  let fail!: (error: Error) => void; let first = true;
  mutation = async () => { if (first) { first = false; return new Promise((_resolve, reject) => { fail = reject; }); } throw new TypeError("Undo Later offline"); };
  const prior = new Date(Date.now() + 1000); const b = bookmark({ laterUntil: prior.toISOString() });
  controller.later(b, new Date(Date.now() + 3600000)); await settle(); controller.getSnapshot().toast!.undo!();
  fail(new TypeError("Later offline")); await settle();
  expect(controller.view(b).laterUntil).toEqual(prior);
});
it.each([1000, -1000])("Later Undo restores a prior %ims timestamp only if still future when Undo occurs", async offset => {
  const b = bookmark({ laterUntil: new Date(Date.now() + offset).toISOString() });
  controller.later(b, new Date(Date.now() + 3600000)); await settle();
  controller.getSnapshot().toast!.undo!(); await settle();
  expect(JSON.parse(writes[1].body!).laterUntil).toEqual(offset > 0 ? b.laterUntil!.toISOString() : null);
});
it("a prior future snooze that elapses during the Undo window is cleared", async () => {
  const b = bookmark({ laterUntil: new Date(Date.now() + 1000).toISOString() });
  controller.later(b, new Date(Date.now() + 3600000)); await settle(); jest.advanceTimersByTime(1001);
  controller.getSnapshot().toast!.undo!(); await settle(); expect(JSON.parse(writes[1].body!).laterUntil).toBeNull();
});
it("failed own archive restores the card, reports connection failure and cancels deferred feedback", async () => {
  mutation = async () => { throw new TypeError("archive offline"); };
  const item = { type: "own_save" as const, bookmark: bookmark() };
  controller.reject(item); expect(controller.isVisible(item)).toBe(false); await settle();
  expect(controller.isVisible(item)).toBe(true); expect(controller.getSnapshot().toast?.message).toBe("Change was not saved. Check your connection.");
  jest.advanceTimersByTime(8000); await settle(); expect(writes).toHaveLength(1);
});
it("failed rejection feedback restores the accepted own archive and announces the exact failure", async () => {
  mutation = async path => { if (path.endsWith("/feedback")) throw new TypeError("feedback offline"); return response(); };
  const item = { type: "own_save" as const, bookmark: bookmark() };
  controller.reject(item); await settle(); controller.closeToast(); await settle();
  expect(controller.isVisible(item)).toBe(true);
  expect(writes.map(write => write.method)).toEqual(["PATCH", "POST", "PATCH"]);
  expect(JSON.parse(writes[2].body!)).toEqual({ isArchived: false });
  expect(controller.getSnapshot().toast?.message).toBe("Change was not saved. Check your connection.");
});
it("expiry during pending archive waits for acceptance; archive failure sends no rejection feedback", async () => {
  let fail!: (error: Error) => void;
  mutation = () => new Promise((_resolve, reject) => { fail = reject; });
  const item = { type: "own_save" as const, bookmark: bookmark() };
  controller.reject(item); await settle(); jest.advanceTimersByTime(8000); await settle();
  expect(writes).toHaveLength(1); fail(new TypeError("archive rejected")); await settle();
  expect(writes.some(write => write.path.endsWith("/feedback"))).toBe(false);
  expect(controller.isVisible(item)).toBe(true);
  expect(controller.getSnapshot().toast?.message).toBe("Change was not saved. Check your connection.");
});
it("failed own rejection and pending Undo restore the confirmed unarchived state", async () => {
  let fail!: (error: Error) => void; let first = true;
  mutation = async () => { if (first) { first = false; return new Promise((_resolve, reject) => { fail = reject; }); } throw new TypeError("Undo archive offline"); };
  const item = { type: "own_save" as const, bookmark: bookmark() };
  controller.reject(item); await settle(); controller.getSnapshot().toast!.undo!(); fail(new TypeError("archive offline")); await settle();
  expect(controller.isVisible(item)).toBe(true);
  expect(writes.some(write => write.path.endsWith("/feedback"))).toBe(false);
});
it("Save to Library uses the existing reshare route and reports successful saving", async () => {
  mutation = async () => new Response(JSON.stringify({ bookmark: json(), alreadySaved: false }), { status: 200 });
  controller.save({ type: "followed_save", bookmark: bookmark({ userId: "other" }) }); await settle();
  expect(writes).toEqual([{ path: "/api/v1/bookmarks/one/reshare", method: "POST", body: undefined }]);
  expect(controller.getSnapshot().toast?.message).toBe("Saved to Cosmic Dolphin");
});
it("Move uses the existing refile contract, updates placement optimistically, and Undo restores Inbox", async () => {
  const b = bookmark(); controller.move(b, "topic", "Fictional topic");
  expect(controller.view(b).collectionId).toBe("topic");
  expect(controller.getSnapshot().toast?.message).toBe("Moved to Fictional topic. Cosmic won't move it again.");
  await settle(); expect(writes[0]).toMatchObject({ path: "/api/v1/bookmarks/one/collection", method: "PATCH" });
  expect(JSON.parse(writes[0].body!)).toEqual({ collectionId: "topic" });
  controller.getSnapshot().toast!.undo!(); await settle();
  expect(controller.view(b).collectionId).toBeUndefined(); expect(JSON.parse(writes[1].body!)).toEqual({ collectionId: null });
});
it("failed Move restores its previous placement with the connection toast", async () => {
  mutation = async () => { throw new TypeError("move offline"); };
  const b = bookmark({ collectionId: "prior", collectionPath: [{ id: "prior", name: "Prior" }] }); controller.move(b, "new", "New"); await settle();
  expect(controller.view(b).collectionId).toBe("prior"); expect(controller.view(b).collectionPath).toEqual([{ id: "prior", name: "Prior" }]);
  expect(controller.getSnapshot().toast?.message).toBe("Change was not saved. Check your connection.");
});
it("the reusable controller refuses owner mutations on another user's bookmark", async () => {
  const foreign = bookmark({ userId: "other" });
  controller.done(foreign); controller.later(foreign); controller.move(foreign, "topic"); await settle();
  expect(writes).toEqual([]); expect(controller.view(foreign).readAt).toBeUndefined();
});
