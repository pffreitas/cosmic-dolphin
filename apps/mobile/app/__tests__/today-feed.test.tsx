import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { Text, RefreshControl } from "react-native";
import { router } from "expo-router";
import HomeScreen from "../(tabs)/index";
import { MobileAPI } from "@/lib/mobile-api";
import type { Bookmark, FeedItem, TodayPicksResponse } from "@cosmic-dolphin/api-client";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "fixture-reader", email: "fixture@example.invalid" } }) }));
jest.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ appearance: "light", interests: [], hiddenTopics: [], update: jest.fn() }) }));
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ captures: [], acknowledge: jest.fn(), revision: 0, drain: jest.fn(async () => {}) }) }));
// The hoisted native-boundary mock resolves Text inside its factory.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@/components/CopiedLink", () => { const Text = require("react-native").Text; return ({ CopiedLink: ({ onPaste }: { onPaste: (url: string) => void }) => <Text onPress={() => onPaste("https://copied.example/article")}>Paste copied link</Text> }); });
jest.mock("@/lib/mobile-api", () => ({
  nativeBookmark: (value: unknown) => value,
  MobileAPI: { feed: jest.fn(), picks: jest.fn(), counts: jest.fn(), resume: jest.fn(), explore: jest.fn() },
}));
function bookmark(id: string, overrides: Partial<Bookmark> = {}): Bookmark {
  return { id, userId: "fixture-reader", title: `Article ${id}`, sourceUrl: `https://${id}.example/article`,
    createdAt: new Date("2026-11-11T10:00:00Z"), updatedAt: new Date("2026-11-11T10:00:00Z"),
    processingStatus: "completed", metadata: { readingTime: 5 }, ...overrides } as Bookmark;
}
const pick = bookmark("pick");
const snapshot = (items = [{ position: 1, bookmark: pick, reason: "The server's exact reason." }]): TodayPicksResponse => ({
  localDate: "2026-11-11", refreshesAt: new Date("2026-11-12T11:00:00Z"), computedAt: new Date("2026-11-11T11:00:00Z"), items,
});
const item = (id: string, overrides: Partial<FeedItem> = {}): FeedItem => ({ type: "own_save", bookmark: bookmark(id), ...overrides });
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("tail")] });
  (MobileAPI.picks as jest.Mock).mockResolvedValue(snapshot());
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 2, unread: 2, archived: 0, inbox: 0, collections: [] });
  (MobileAPI.resume as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.explore as jest.Mock).mockResolvedValue({ items: [] });
});
function home() { return renderRouter({ index: HomeScreen, library: () => <Text>Library destination</Text>, save: () => <Text>Save destination</Text> }); }
it("For you renders the fixed server pick and its verbatim reason before the finite feed", async () => {
  home();
  expect(await screen.findByText("Today's 5")).toBeTruthy();
  expect(screen.getByText("0 of 1 done · 5 min left")).toBeTruthy();
  expect(screen.getByText("The server's exact reason.")).toBeTruthy();
  expect(screen.getByText("Article pick")).toBeTruthy();
  expect(screen.getByText("Article tail")).toBeTruthy();
  expect(MobileAPI.picks).toHaveBeenCalled();
});
it("orders captures, fixed picks, Continue reading, ten more unsnoozed items, and the Library end", async () => {
  const resume = bookmark("resume");
  (MobileAPI.resume as jest.Mock).mockResolvedValue({ items: [{ bookmark: resume, progress: { percent: 60 } }] });
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [
    { type: "pending", bookmark: bookmark("pending", { processingStatus: "processing" }) },
    { type: "own_save", bookmark: pick },
    item("snoozed", { bookmark: bookmark("snoozed", { laterUntil: new Date(Date.now() + 3600000) }) }),
    ...Array.from({ length: 12 }, (_, index) => item(`tail${index}`)),
  ], nextCursor: "more" });
  home();
  expect(await screen.findByText("You're caught up")).toBeTruthy();
  expect(screen.getByText("2 unread saves are in your Library.")).toBeTruthy();
  expect(screen.queryByText("Article snoozed")).toBeNull();
  expect(screen.queryByText("Article tail10")).toBeNull();
  expect(screen.getAllByText("Article pick")).toHaveLength(1);
  const cards = screen.getAllByTestId(/^feed-card-/).map(node => node.props.testID);
  expect(cards).toEqual(["feed-card-pick", ...Array.from({ length: 10 }, (_, index) => `feed-card-tail${index}`)]);
  const serialized = screen.getAllByText(/^(Article pending|Today's 5|Article pick|Continue reading.*|Article resume|Article tail0)$/).map(node => [node.props.children].flat().join("")).join("\n");
  expect(serialized.indexOf("Article pending")).toBeLessThan(serialized.indexOf("Today's 5"));
  expect(serialized.indexOf("Article pick")).toBeLessThan(serialized.indexOf("Continue reading"));
  expect(serialized.indexOf("Article resume")).toBeLessThan(serialized.indexOf("Article tail0"));
  expect(screen.queryByText("More reading lists")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Open Library" }));
  expect(await screen.findByText("Library destination")).toBeTruthy();
});
it("first run offers copied-link paste and share instructions without promising replacement picks", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ ...snapshot([]), computedAt: undefined });
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 0, unread: 0, archived: 0, inbox: 0, collections: [] });
  home();
  expect(await screen.findByText("Close the tab. Cosmic will bring it back.")).toBeTruthy();
  expect(screen.getByText("Save a link and your first pick appears here as soon as Cosmic has read it.")).toBeTruthy();
  expect(screen.getByText("Share from any app: tap Share, then Cosmic Dolphin.")).toBeTruthy();
  expect(screen.getByText("Paste copied link")).toBeTruthy();
  expect(screen.queryByText("You're caught up")).toBeNull();
  fireEvent.press(screen.getByText("Paste copied link"));
  expect(await screen.findByText("Save destination")).toBeTruthy();
});
it("existing saves with no row explain eligibility rather than showing first run", async () => {
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ ...snapshot([]), computedAt: undefined });
  home();
  expect(await screen.findByText("No picks right now")).toBeTruthy();
  expect(screen.getByText("No saved links are ready for a pick right now. A new save can become a pick once Cosmic has read it.")).toBeTruthy();
  expect(screen.queryByText("Close the tab. Cosmic will bring it back.")).toBeNull();
  expect(screen.getByText("Article tail")).toBeTruthy();
});
it("a stored set with no visible picks explains hidden slots and never shows All 0 done", async () => {
  (MobileAPI.picks as jest.Mock).mockResolvedValue(snapshot([]));
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 0, unread: 0, archived: 2, inbox: 0, collections: [] });
  home();
  expect(await screen.findByText("No picks to show")).toBeTruthy();
  expect(screen.getByText("Today's picks are set for later or no longer in your Library. New saves appear below.")).toBeTruthy();
  expect(screen.queryByText("All 0 done")).toBeNull();
  expect(screen.queryByText("No picks right now")).toBeNull();
  expect(screen.queryByText("Close the tab. Cosmic will bring it back.")).toBeNull();
});
it("drops the minutes clause if any visible pick lacks time, retains done slots and gives truthful all-done copy", async () => {
  const done = bookmark("done", { readAt: new Date(), metadata: {} });
  (MobileAPI.picks as jest.Mock).mockResolvedValue(snapshot([
    { position: 1, bookmark: done, reason: "Done reason" }, { position: 3, bookmark: pick, reason: "Undone reason" },
  ]));
  home();
  expect(await screen.findByText("1 of 2 done")).toBeTruthy();
  expect(screen.queryByText(/min left/)).toBeNull();
  expect(screen.getByText("Article done")).toBeTruthy();
  (MobileAPI.picks as jest.Mock).mockResolvedValue(snapshot([
    { position: 1, bookmark: bookmark("done", { readAt: new Date() }), reason: "Done reason" },
    { position: 3, bookmark: bookmark("pick", { readAt: new Date() }), reason: "Undone reason" },
  ]));
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  expect(await screen.findByText("All 2 done")).toBeTruthy();
  expect(screen.getByText("10 minutes of reading cleared today")).toBeTruthy();
});
it("partial picks failure keeps the feed usable and Retry re-reads the fixed set and late-completed saves", async () => {
  (MobileAPI.picks as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  home();
  expect(await screen.findByText("Today's picks couldn't load.")).toBeTruthy();
  expect(screen.getByText("Article tail")).toBeTruthy();
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("late")] });
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Today's 5")).toBeTruthy();
  expect(screen.getByText("Article late")).toBeTruthy();
  expect(screen.queryByText("Today's picks couldn't load.")).toBeNull();
  expect(screen.queryByText("Article tail")).toBeNull();
  expect(MobileAPI.picks).toHaveBeenCalledTimes(2);
});
it("a whole initial load failure offers Retry without displaying an empty-day success", async () => {
  (MobileAPI.feed as jest.Mock).mockRejectedValueOnce(new Error("network"));
  (MobileAPI.picks as jest.Mock).mockRejectedValueOnce(new Error("network"));
  home();
  expect(await screen.findByText("Your reading lists will be back")).toBeTruthy();
  expect(screen.getByText("Try loading your feed again.")).toBeTruthy();
  expect(screen.queryByText("You're caught up")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Article pick")).toBeTruthy();
});
it("failed refresh preserves the previously loaded set and list with the exact offline Notice", async () => {
  home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  (MobileAPI.feed as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  (MobileAPI.picks as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  expect(await screen.findByText("You're offline. Previously loaded saves are shown. Connect to save changes.")).toBeTruthy();
  expect(screen.getByText("Article pick")).toBeTruthy();
  expect(screen.getByText("Article tail")).toBeTruthy();
  expect(screen.queryByText("Your reading lists will be back")).toBeNull();
});
it("a cold offline load restores only its account-scoped cached picks and feed", async () => {
  const route = home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith("home-feed:v1:fixture-reader:for_you", expect.any(String)));
  route.unmount();
  (MobileAPI.feed as jest.Mock).mockRejectedValue(new Error("offline"));
  (MobileAPI.picks as jest.Mock).mockRejectedValue(new Error("offline"));
  home();
  expect(await screen.findByText("You're offline. Previously loaded saves are shown. Connect to save changes.")).toBeTruthy();
  expect(screen.getByText("Article pick")).toBeTruthy();
  expect(screen.getByText("The server's exact reason.")).toBeTruthy();
});
it("shows a picks server error after a successful load without claiming the device is offline", async () => {
  home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  (MobileAPI.picks as jest.Mock).mockRejectedValueOnce({ response: new Response(null, { status: 500 }) });
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  expect(await screen.findByText("Today's picks couldn't load.")).toBeTruthy();
  expect(screen.getByText("Article tail")).toBeTruthy();
  expect(screen.queryByText("You're offline. Previously loaded saves are shown. Connect to save changes.")).toBeNull();
});
it.each(["Following", "Unread"])("%s keeps a paged list without picks, Continue or the caught-up end", async label => {
  (MobileAPI.feed as jest.Mock).mockImplementation(async (scope, cursor) => ({
    items: cursor ? [item("page2")] : scope === "for_you" ? [item("tail")] : [item("newest"), item("older")],
    nextCursor: cursor ? undefined : "page2",
  }));
  home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  const pickRequests = (MobileAPI.picks as jest.Mock).mock.calls.length;
  fireEvent.press(screen.getByRole("tab", { name: label }));
  expect(await screen.findByText("Article newest")).toBeTruthy();
  expect(screen.queryByText("Today's 5")).toBeNull();
  expect(screen.queryByText(/Continue reading/)).toBeNull();
  expect(screen.queryByText("You're caught up")).toBeNull();
  expect(screen.getAllByTestId(/^feed-card-/).map(node => node.props.testID)).toEqual(["feed-card-newest", "feed-card-older"]);
  expect(MobileAPI.picks).toHaveBeenCalledTimes(pickRequests);
  fireEvent.press(screen.getByRole("button", { name: label === "Unread" ? "More saves" : "More reading lists" }));
  expect(await screen.findByText("Article page2")).toBeTruthy();
  expect(MobileAPI.feed).toHaveBeenLastCalledWith(label.toLowerCase(), "page2");
});
it.each(["Following", "Unread"])("%s renders its existing empty state with the scope controls available", async label => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [] });
  home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: label }));
  expect(await screen.findByText(label === "Following" ? "Good reading travels through people" : "A fresh starting point")).toBeTruthy();
  expect(screen.getByText("Save a link to start shaping your feed. Public discoveries and connected reading lists will appear as they become available.")).toBeTruthy();
  expect(screen.queryByText("You're caught up")).toBeNull();
  expect(screen.getByRole("tab", { name: "For you" })).toBeTruthy();
});
it("For you loading mirrors the progress bar and three rows while scope controls remain usable", async () => {
  let resolveFeed!: (value: { items: FeedItem[] }) => void;
  (MobileAPI.feed as jest.Mock).mockReturnValue(new Promise(resolve => { resolveFeed = resolve; }));
  home();
  expect(screen.getByTestId("today-skeleton-bar")).toBeTruthy();
  expect(screen.getAllByTestId("today-skeleton-row")).toHaveLength(3);
  expect(screen.getByRole("tab", { name: "Unread" })).toBeTruthy();
  resolveFeed({ items: [] });
  await screen.findByText("Today's 5");
});
it("shows followed actor/reason verbatim, omits absent reasons and private notes, and retains digest sources", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [
    item("followed", { type: "followed_save", actor: { id: "actor", handle: "maya", name: "Maya" }, rankingReason: "Maya's server reason.", bookmark: bookmark("followed", { userId: "actor", userNote: "PRIVATE_NOTE_NEVER_RENDER" }) }),
    item("no-reason"),
    { type: "digest", digest: { id: "digest", title: "Server digest title", summary: "Server digest thesis", keyPoints: [], sources: [{ bookmarkId: "source", title: "Source title", domain: "source.example" }] } },
  ] });
  home();
  expect(await screen.findByText("Server digest title")).toBeTruthy();
  expect(screen.getByText("Maya's server reason.")).toBeTruthy();
  expect(screen.getByText(/Maya · shared/)).toBeTruthy();
  expect(screen.queryByText("PRIVATE_NOTE_NEVER_RENDER")).toBeNull();
  expect(screen.getByText("Article no-reason")).toBeTruthy();
  expect(screen.getByTestId("feed-card-no-reason").findAllByProps({ testID: "ranking-reason" })).toHaveLength(0);
  expect(screen.getByText("Server digest thesis")).toBeTruthy();
  expect(screen.getByText("Source title")).toBeTruthy();
  expect(screen.getByText("Built from")).toBeTruthy();
});
it.each(["Following", "Unread"])("%s supports loading, failed Retry and cached offline reads without For-you sections", async label => {
  home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  let resolveFeed!: (value: { items: FeedItem[] }) => void;
  (MobileAPI.feed as jest.Mock).mockReturnValueOnce(new Promise(resolve => { resolveFeed = resolve; }));
  fireEvent.press(screen.getByRole("tab", { name: label }));
  expect(await screen.findByRole("progressbar", { name: "Loading content" })).toBeTruthy();
  expect(screen.queryByTestId("today-skeleton-bar")).toBeNull();
  resolveFeed({ items: [item("scope")] });
  expect(await screen.findByText("Article scope")).toBeTruthy();
  (MobileAPI.feed as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  expect(await screen.findByText("You're offline. Previously loaded saves are shown. Connect to save changes.")).toBeTruthy();
  expect(screen.getByText("Article scope")).toBeTruthy();
  expect(screen.queryByText("You're caught up")).toBeNull();
  expect(screen.queryByText("Today's 5")).toBeNull();
});
it.each(["Following", "Unread"])("%s initial failure exposes its existing Retry recovery", async label => {
  home();
  expect(await screen.findByText("Article pick")).toBeTruthy();
  (MobileAPI.feed as jest.Mock).mockRejectedValueOnce(new Error("network"));
  fireEvent.press(screen.getByRole("tab", { name: label }));
  expect(await screen.findByText("Some reading suggestions could not be loaded. Pull to refresh or try again.")).toBeTruthy();
  expect(screen.queryByText("You're caught up")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Article tail")).toBeTruthy();
});
it("first focus after revealsAt restores the fifth original slot: 1 of 4 becomes 1 of 5", async () => {
  const original = Array.from({ length: 5 }, (_, index) => ({ position: index + 1,
    bookmark: bookmark(`slot${index + 1}`, index === 0 ? { readAt: new Date() } : {}), reason: `Original reason ${index + 1}` }));
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ ...snapshot(original.filter(item => item.position !== 4)), revealsAt: new Date(Date.now() - 1000) });
  renderRouter({ index: HomeScreen, away: () => <Text>Away</Text> });
  expect(await screen.findByText("1 of 4 done · 15 min left")).toBeTruthy();
  expect(screen.queryByText("Article slot4")).toBeNull();
  act(() => router.push("/away"));
  expect(await screen.findByText("Away")).toBeTruthy();
  (MobileAPI.picks as jest.Mock).mockResolvedValue(snapshot(original));
  act(() => router.back());
  expect(await screen.findByText("1 of 5 done · 20 min left")).toBeTruthy();
  expect(screen.getByText("Original reason 4")).toBeTruthy();
  expect(screen.getByText("Article slot1")).toBeTruthy();
  expect(MobileAPI.picks).toHaveBeenCalledTimes(2);
  expect(MobileAPI.feed).toHaveBeenCalledTimes(2);
});
