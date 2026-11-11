import React from "react";
import { Text, RefreshControl } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import HomeScreen from "@/app/(tabs)/index";
import BookmarkDetailScreen from "@/app/bookmark/[id]";
import { MobileAPI } from "@/lib/mobile-api";

let mockUserId = "reader";
const mockAuthListeners = new Set<() => void>();
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => {
  const id = require("react").useSyncExternalStore((listener: () => void) => { mockAuthListeners.add(listener); return () => { mockAuthListeners.delete(listener); }; }, () => mockUserId, () => mockUserId);
  return { user: { id } };
} }));
jest.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ appearance: "light", interests: [], hiddenTopics: [] }) }));
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ captures: [], acknowledge: jest.fn(), revision: 0, drain: jest.fn(async () => {}) }) }));
jest.mock("@/components/CopiedLink", () => ({ CopiedLink: () => null }));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "fictional-token", user: { id: "reader" } } } }) } } }));
jest.mock("@/lib/bookmark-cache", () => ({ cacheBookmarksInBackground: jest.fn() }));

const originalFetch = global.fetch;
const stamp = "2026-11-11T10:00:00Z";
function bookmark(id: string, extra = {}) {
  return { id, userId: "reader", title: `Article ${id}`, sourceUrl: `https://${id}.example/article`, createdAt: stamp, updatedAt: stamp,
    processingStatus: "completed", isArchived: false, metadata: { readingTime: 5 }, ...extra };
}
let picks: ReturnType<typeof bookmark>[];
let items: object[];
let writes: { path: string; method?: string; body?: string }[];
let mutation: (path: string, init?: RequestInit) => Promise<Response>;
let heldPicks: (() => Promise<Response>) | undefined;
let heldCollections: (() => Promise<Response>) | undefined;
let reads: string[];
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
beforeEach(() => {
  mockUserId = "reader";
  picks = [bookmark("one"), bookmark("two")]; items = []; writes = []; heldPicks = undefined; heldCollections = undefined; reads = [];
  mutation = async path => response(bookmark(path.includes("two") ? "two" : "one"));
  const fetcher = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(input as string, "https://fixture.invalid").pathname;
    if (init?.method && init.method !== "GET") {
      writes.push({ path, method: init.method, body: init.body as string });
      return mutation(path, init);
    }
    reads.push(path);
    if (path === "/api/v1/bookmarks/shared/public-article") return response(bookmark("foreign", { userId: "other", isPublic: true, shareSlug: "public-article", cosmicBriefSummary: "Public article brief" }));
    if (path === "/api/v1/bookmarks/foreign") return new Response(JSON.stringify({ error: "Bookmark not found" }), { status: 404 });
    if (path.endsWith("/picks/today")) return heldPicks ? heldPicks() : response({ localDate: "2026-11-11", computedAt: stamp, refreshesAt: "2026-11-12T11:00:00Z", items: picks.map((b, i) => ({ position: i + 1, bookmark: b, reason: `Original reason ${b.id}` })) });
    if (path.endsWith("/feed")) return response({ items });
    if (path.endsWith("/counts")) return response({ all: 2, unread: 2, archived: 0, inbox: 0, collections: [] });
    if (path.endsWith("/continue-reading")) return response({ items: [] });
    if (path.endsWith("/collections")) return heldCollections ? heldCollections() : response({ collections: [] });
    throw new Error(`Unexpected fixture route ${path}`);
  });
  global.fetch = Object.assign(fetcher, { preconnect: originalFetch.preconnect });
});
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });
function home() { return renderRouter({ index: HomeScreen, bookmark: () => <Text>Bookmark destination</Text> }); }
it("Done keeps a completed pick done; Mark not done in its menu explicitly clears it", async () => {
  picks[0] = bookmark("one", { readAt: stamp });
  home(); await screen.findByText("1 of 2 done · 5 min left");
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  await waitFor(() => expect(writes[0]).toMatchObject({ method: "PUT", path: "/api/v1/bookmarks/one/read" }));
  fireEvent.press(screen.getAllByRole("button", { name: "More actions" })[0]);
  fireEvent.press(screen.getByRole("button", { name: "Mark not done" }));
  expect(screen.getByText("0 of 2 done · 10 min left")).toBeTruthy();
  await waitFor(() => expect(writes[1]).toMatchObject({ method: "DELETE", path: "/api/v1/bookmarks/one/read" }));
});
it("Done writes at once, keeps the original pick and reason, updates the count, and Undo restores unread through the API", async () => {
  let accept!: (value: Response) => void;
  mutation = () => new Promise(resolve => { accept = resolve; });
  home();
  await screen.findByText("0 of 2 done · 10 min left");
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  expect(screen.getByText("Original reason one")).toBeTruthy();
  expect(screen.getByText("Article one")).toBeTruthy();
  await waitFor(() => expect(writes).toEqual([{ path: "/api/v1/bookmarks/one/read", method: "PUT", body: undefined }]));
  await act(async () => accept(response(bookmark("one", { readAt: stamp }))));
  mutation = async () => response(bookmark("one"));
  fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("0 of 2 done · 10 min left")).toBeTruthy();
  await waitFor(() => expect(writes[1]).toMatchObject({ path: "/api/v1/bookmarks/one/read", method: "DELETE" }));
});
it("Later sends Tonight immediately, hides only that original slot, and Undo restores the count with a clearing PATCH", async () => {
  home(); await screen.findByText("0 of 2 done · 10 min left");
  fireEvent.press(screen.getAllByRole("button", { name: "Later" })[0]);
  fireEvent.press(screen.getByRole("button", { name: /^Tonight,/ }));
  expect(screen.queryByText("Article one")).toBeNull();
  expect(screen.getByText("0 of 1 done · 5 min left")).toBeTruthy();
  await waitFor(() => expect(writes[0]).toMatchObject({ path: "/api/v1/bookmarks/one", method: "PATCH" }));
  const sent = new Date(JSON.parse(writes[0].body!).laterUntil);
  expect(sent.getTime()).toBeGreaterThan(Date.now()); expect(sent.getHours()).toBe(20);
  expect(screen.getByText(/^Back /)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("0 of 2 done · 10 min left")).toBeTruthy();
  expect(screen.getByText("Original reason one")).toBeTruthy();
  await waitFor(() => expect(JSON.parse(writes[1].body!)).toEqual({ laterUntil: null }));
});
it("a rejected Done request restores the count and announces the exact connection failure", async () => {
  let reject!: (error: Error) => void;
  mutation = () => new Promise((_resolve, fail) => { reject = fail; });
  home(); await screen.findByText("0 of 2 done · 10 min left");
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  await waitFor(() => expect(writes).toHaveLength(1));
  await act(async () => reject(new TypeError("Network request failed")));
  expect(screen.getByText("0 of 2 done · 10 min left")).toBeTruthy();
  expect(screen.getByText("Change was not saved. Check your connection.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});
it("a rejected Later PATCH restores the original slot and exact failure toast", async () => {
  mutation = async () => { throw new TypeError("offline"); };
  home(); await screen.findByText("0 of 2 done · 10 min left");
  fireEvent.press(screen.getAllByRole("button", { name: "Later" })[0]);
  fireEvent.press(screen.getByRole("button", { name: /^Tonight,/ }));
  expect(screen.queryByText("Article one")).toBeNull();
  await screen.findByText("Change was not saved. Check your connection.");
  expect(screen.getByText("Original reason one")).toBeTruthy();
  expect(screen.getByText("0 of 2 done · 10 min left")).toBeTruthy();
});
it("own overflow and long press expose exactly five actions, including not-done and the existing Move list", async () => {
  home(); await screen.findByText("Article one");
  fireEvent.press(screen.getAllByRole("button", { name: "More actions" })[0]);
  expect(["Open", "Mark done", "Later…", "Move to topic…", "Not for me"].map(name => screen.getByRole("button", { name }).props.accessibilityLabel)).toHaveLength(5);
  expect(screen.queryByRole("button", { name: "Save to Library" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Mark done" }));
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  fireEvent(screen.getByRole("button", { name: "Open Article one" }), "longPress");
  expect(screen.getByRole("button", { name: "Mark not done" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Move to topic…" }));
  expect(await screen.findByRole("button", { name: "Inbox" })).toBeTruthy();
});
it.each(["followed_save", "reshare"])("%s has only Open, Save to Library and Not for me in its menu, with no Done or Later", async type => {
  picks = []; items = [{ type, bookmark: bookmark("foreign", { userId: "other" }) }];
  home(); await screen.findByText("Article foreign");
  expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "More actions" }));
  expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Save to Library" })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Not for me" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mark done" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Move to topic…" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Later…" })).toBeNull();
  expect(writes).toEqual([]);
});
it("a digest's long-press menu offers Open only and exposes no mutation controls", async () => {
  picks = []; items = [{ type: "digest", digest: { id: "digest", title: "Fictional digest", summary: "Summary", keyPoints: [], sources: [] } }];
  home(); await screen.findByText("Fictional digest");
  fireEvent(screen.getByRole("button", { name: "Open Fictional digest" }), "longPress");
  expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
  for (const name of ["Done", "Later", "Save to Library", "Not for me", "Mark done", "Move to topic…"]) expect(screen.queryByRole("button", { name })).toBeNull();
  expect(writes).toEqual([]);
});
it("own cards support right Done and left Tonight gestures without taking vertical scrolling", async () => {
  home(); await screen.findByText("Article one");
  const card = screen.getByTestId("swipe-card-one");
  fireEvent(card, "touchStart", { nativeEvent: { pageX: 100, pageY: 100 } });
  expect(card.props.onMoveShouldSetResponder({ nativeEvent: { pageX: 104, pageY: 180 } })).toBe(false);
  expect(card.props.onMoveShouldSetResponder({ nativeEvent: { pageX: 180, pageY: 104 } })).toBe(true);
  fireEvent(card, "responderRelease", { nativeEvent: { pageX: 180, pageY: 104 } });
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  fireEvent(screen.getByTestId("swipe-card-two"), "touchStart", { nativeEvent: { pageX: 180, pageY: 100 } });
  fireEvent(screen.getByTestId("swipe-card-two"), "responderRelease", { nativeEvent: { pageX: 100, pageY: 104 } });
  expect(screen.queryByText("Article two")).toBeNull();
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[0].method).toBe("PUT");
  expect(new Date(JSON.parse(writes[1].body!).laterUntil).getHours()).toBe(20);
});
it("own screen-reader Mark done, Later and More actions perform the same visible actions", async () => {
  home(); await screen.findByText("Article one");
  const title = screen.getByRole("button", { name: "Open Article one" });
  expect(title.props.accessibilityActions.map((action: { label: string }) => action.label)).toEqual(["Mark done", "Later", "More actions"]);
  fireEvent(title, "accessibilityAction", { nativeEvent: { actionName: "done" } });
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  fireEvent(screen.getByRole("button", { name: "Open Article one" }), "accessibilityAction", { nativeEvent: { actionName: "later" } });
  expect(screen.getByRole("button", { name: /^Tonight,/ })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent(screen.getByRole("button", { name: "Open Article one" }), "accessibilityAction", { nativeEvent: { actionName: "more" } });
  expect(screen.getByRole("button", { name: "Mark not done" })).toBeTruthy();
});
it.each(["followed_save", "reshare"])("%s has no horizontal responder or owner screen-reader actions", async type => {
  picks = []; items = [{ type, bookmark: bookmark("foreign", { userId: "other" }) }];
  home(); await screen.findByText("Article foreign");
  expect(screen.queryByTestId("swipe-card-foreign")).toBeNull();
  const title = screen.getByRole("button", { name: "Open Article foreign" });
  expect(title.props.accessibilityActions.map((action: { label: string }) => action.label)).toEqual(["More actions"]);
  fireEvent(title, "accessibilityAction", { nativeEvent: { actionName: "done" } });
  fireEvent(title, "accessibilityAction", { nativeEvent: { actionName: "later" } });
  expect(writes).toEqual([]);
});
it("own Not for me hides its original Home slot immediately, and visible Undo restores it without feedback", async () => {
  home(); await screen.findByText("Article one");
  fireEvent.press(screen.getAllByRole("button", { name: "More actions" })[0]);
  fireEvent.press(screen.getByRole("button", { name: "Not for me" }));
  expect(screen.queryByText("Article one")).toBeNull(); expect(screen.getByText("0 of 1 done · 5 min left")).toBeTruthy();
  await waitFor(() => expect(JSON.parse(writes[0].body!)).toEqual({ isArchived: true }));
  fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("Original reason one")).toBeTruthy();
  await waitFor(() => expect(writes).toHaveLength(2)); expect(JSON.parse(writes[1].body!)).toEqual({ isArchived: false });
});
it("visible Save to Library calls existing reshare and reverts its optimistic status on failure", async () => {
  picks = []; items = [{ type: "reshare", bookmark: bookmark("foreign", { userId: "other" }) }];
  mutation = async () => { throw new TypeError("reshare offline"); };
  home(); await screen.findByText("Article foreign"); fireEvent.press(screen.getByRole("button", { name: "Save to Library" }));
  expect(screen.getByText("Saved to Cosmic Dolphin")).toBeTruthy();
  await screen.findByText("Change was not saved. Check your connection.");
  expect(writes[0]).toMatchObject({ path: "/api/v1/bookmarks/foreign/reshare", method: "POST" });
  expect(screen.queryByText("Saved to Cosmic Dolphin")).toBeNull();
});
it("Later offers all four computed day/time choices and Not for me; Tomorrow persists local 07:00 with exact success copy", async () => {
  home(); await screen.findByText("Article one"); fireEvent.press(screen.getAllByRole("button", { name: "Later" })[0]);
  for (const name of [/^Tonight, \w{3}, 8 pm$/, /^Tomorrow morning, \w{3}, 7 am$/, /^This weekend, \w{3}, 9 am$/, /^Next week, Mon, 7 am$/]) expect(screen.getByRole("button", { name })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Not for me" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: /^Tomorrow morning,/ }));
  expect(screen.getByText("Back tomorrow at 7 am")).toBeTruthy();
  await waitFor(() => expect(writes).toHaveLength(1)); expect(new Date(JSON.parse(writes[0].body!).laterUntil).getHours()).toBe(7);
});
it("after the last visible pick is snoozed, Home shows the exact no-visible-picks state and never All 0 done", async () => {
  picks = [bookmark("one")]; home(); await screen.findByText("Article one");
  fireEvent(screen.getByTestId("swipe-card-one"), "touchStart", { nativeEvent: { pageX: 180, pageY: 100 } });
  fireEvent(screen.getByTestId("swipe-card-one"), "responderRelease", { nativeEvent: { pageX: 100, pageY: 100 } });
  expect(screen.getByText("No picks to show")).toBeTruthy();
  expect(screen.getByText("Today's picks are set for later or no longer in your Library. New saves appear below.")).toBeTruthy();
  expect(screen.queryByText("All 0 done")).toBeNull();
});
it("a fresh Home read honors persisted two-device read state instead of retaining an older acknowledged local overlay", async () => {
  const read = jest.spyOn(MobileAPI, "read");
  mutation = async () => response(bookmark("one", { readAt: stamp }));
  home(); await screen.findByText("Article one"); fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  await act(async () => { await read.mock.results[0].value; });
  // Another device marks this same original slot unread; the next server read is authoritative.
  await act(async () => { screen.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
  await waitFor(() => expect(screen.getByText("0 of 2 done · 10 min left")).toBeTruthy());
  expect(screen.getByText("Original reason one")).toBeTruthy();
});
it("a Home read started before Done cannot undo the accepted action when its stale response arrives", async () => {
  home(); await screen.findByText("Article one");
  let resolveOld!: (value: Response) => void;
  heldPicks = () => new Promise(resolve => { resolveOld = resolve; });
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  await waitFor(() => expect(resolveOld).toBeDefined());
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  await waitFor(() => expect(writes).toHaveLength(1));
  await act(async () => {});
  await act(async () => resolveOld(response({ localDate: "2026-11-11", computedAt: stamp, refreshesAt: "2026-11-12T11:00:00Z", items: picks.map((b, i) => ({ position: i + 1, bookmark: b, reason: `Original reason ${b.id}` })) })));
  await waitFor(() => expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false));
  expect(screen.getByText("1 of 2 done · 5 min left")).toBeTruthy();
  expect(screen.getByText("Original reason one")).toBeTruthy();
});
it("Done and Undo update the caught-up unread Library count as well as Today's progress", async () => {
  home(); await screen.findByText("2 unread saves are in your Library.");
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  expect(screen.getByText("1 unread saves are in your Library.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("2 unread saves are in your Library.")).toBeTruthy();
});
it("Done on an additional own unread card removes it from the finite tail and Undo returns it; done picks remain", async () => {
  items = [{ type: "own_save", bookmark: bookmark("tail") }];
  home(); await screen.findByText("Article tail");
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[2]);
  expect(screen.queryByText("Article tail")).toBeNull(); expect(screen.getByText("Article one")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Undo" })); expect(screen.getByText("Article tail")).toBeTruthy();
});

it("drains a requested Undo after reader navigation unmounts Home before the Done ACK", async () => {
  let accept!: (value: Response) => void;
  mutation = async (_path, init) => init?.method === "PUT" ? new Promise(resolve => { accept = resolve; }) : response(bookmark("one"));
  const view = home(); await screen.findByText("0 of 2 done · 10 min left");
  fireEvent.press(screen.getAllByRole("button", { name: "Done" })[0]);
  await waitFor(() => expect(writes).toHaveLength(1));
  fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  view.unmount();
  await act(async () => accept(response(bookmark("one", { readAt: stamp }))));
  await waitFor(() => expect(writes.map(write => write.method)).toEqual(["PUT", "DELETE"]));
});
it("drains navigation feedback after unmount even when the own archive ACK is delayed", async () => {
  let accept!: (value: Response) => void;
  mutation = async (_path, init) => init?.method === "PATCH" ? new Promise(resolve => { accept = resolve; }) : response({});
  const view = home(); await screen.findByText("Article one");
  fireEvent.press(screen.getAllByRole("button", { name: "More actions" })[0]);
  fireEvent.press(screen.getByRole("button", { name: "Not for me" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  view.unmount();
  await act(async () => accept(response(bookmark("one", { isArchived: true }))));
  await waitFor(() => expect(writes.filter(write => write.path.endsWith("/feedback"))).toHaveLength(1));
});

it("hides an open private Home menu immediately when the account changes", async () => {
  picks[0] = bookmark("one", { isPrivateLink: true, title: "A PRIVATE MENU TITLE" });
  const view = home(); await view.findByText("A PRIVATE MENU TITLE");
  fireEvent.press(view.getAllByRole("button", { name: "More actions" })[0]);
  expect(view.getAllByText("A PRIVATE MENU TITLE")).toHaveLength(2);
  await act(async () => { mockUserId = "next-reader"; picks = []; items = []; mockAuthListeners.forEach(listener => listener()); });
  expect(view.queryByRole("button", { name: "Move to topic…" })).toBeNull();
  await waitFor(() => expect(view.queryByText("A PRIVATE MENU TITLE")).toBeNull());
});

it("ignores a collection response from the account whose Move sheet was closed", async () => {
  let accept!: (value: Response) => void;
  heldCollections = () => new Promise(resolve => { accept = resolve; });
  const view = home(); await screen.findByText("Article one");
  fireEvent.press(screen.getAllByRole("button", { name: "More actions" })[0]);
  fireEvent.press(screen.getByRole("button", { name: "Move to topic…" }));
  await waitFor(() => expect(accept).toBeDefined());
  await act(async () => { mockUserId = "next-reader"; picks = []; items = []; mockAuthListeners.forEach(listener => listener()); });
  await act(async () => accept(response({ collections: [{ id: "a-private-topic", name: "A PRIVATE COLLECTION", createdAt: stamp, updatedAt: stamp }] })));
  expect(view.queryByText("A PRIVATE COLLECTION")).toBeNull();
  expect(view.queryByRole("button", { name: "Inbox" })).toBeNull();
});
it.each([ ["followed_save", "card"], ["followed_save", "menu"], ["reshare", "card"], ["reshare", "menu"] ])("opens a %s public article from its %s through the shared-slug HTTP contract", async (type, entry) => {
  picks = []; items = [{ type, bookmark: bookmark("foreign", { userId: "other", isPublic: true, shareSlug: "public-article" }) }];
  renderRouter({ index: HomeScreen, "bookmark/[id]": BookmarkDetailScreen });
  await screen.findByText("Article foreign");
  if (entry === "menu") {
    fireEvent.press(screen.getByRole("button", { name: "More actions" }));
    fireEvent.press(screen.getByRole("button", { name: "Open" }));
  } else fireEvent.press(screen.getByRole("button", { name: "Open Article foreign" }));
  expect(await screen.findByText("Public article brief")).toBeTruthy();
  expect(reads).toContain("/api/v1/bookmarks/shared/public-article");
  expect(reads).not.toContain("/api/v1/bookmarks/foreign");
  expect(reads).not.toContain("/api/v1/bookmarks/foreign/content");
  expect(screen.queryByText("Add a note")).toBeNull();
});
