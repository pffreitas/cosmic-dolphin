import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { Text, RefreshControl, StatusBar, FlatList, ScrollView, StyleSheet } from "react-native";
import { router, Stack } from "expo-router";
import HomeScreen from "../(tabs)/index";
import SaveScreen from "../save";
import TabLayout from "../(tabs)/_layout";
import { Chip } from "@/components/ui/Signal";
import { colors } from "@/constants/theme";
const mockCaptureSave = jest.fn(async () => "clipboard-capture");
import { MobileAPI } from "@/lib/mobile-api";
import type { Bookmark, FeedItem, TodayPicksResponse } from "@cosmic-dolphin/api-client";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "fixture-reader", email: "fixture@example.invalid" } }) }));
jest.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ appearance: "light", interests: [], hiddenTopics: [], update: jest.fn() }) }));
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ captures: [], save: mockCaptureSave, confirm: jest.fn(), acknowledge: jest.fn(), revision: 0, drain: jest.fn(async () => {}) }) }));
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
it("opens one finite for_you timeline without audience scopes or a viewer action", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("tail")], nextCursor: "unused" });
  home();
  await screen.findByText("Article tail");
  for (const name of ["For you", "Following", "Unread"]) expect(screen.queryByRole("tab", { name })).toBeNull();
  expect(screen.queryByRole("button", { name: "Today's 5" })).toBeNull();
  expect(MobileAPI.feed).toHaveBeenCalledTimes(1);
  expect(MobileAPI.feed).toHaveBeenLastCalledWith("for_you");
  expect(screen.queryByText("More reading lists")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Open Library" }));
  expect(await screen.findByText("Library destination")).toBeTruthy();
  expect(MobileAPI.feed).toHaveBeenCalledTimes(1);
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
it("feed-only failure retains inline picks and Retry restores the finite tail", async () => {
  (MobileAPI.feed as jest.Mock).mockRejectedValueOnce({ response: { status: 500 } });
  home();
  await screen.findByText("Some reading suggestions could not be loaded. Pull to refresh or try again.");
  expect(screen.getByText("Article pick")).toBeTruthy();
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText("Your reading lists will be back")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Article tail");
  expect(screen.getByText("You're caught up")).toBeTruthy();
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
it("Home loading mirrors the progress bar and three rows with All topics available", async () => {
  let resolveFeed!: (value: { items: FeedItem[] }) => void;
  (MobileAPI.feed as jest.Mock).mockReturnValue(new Promise(resolve => { resolveFeed = resolve; }));
  home();
  expect(screen.getByTestId("today-skeleton-bar")).toBeTruthy();
  expect(screen.getAllByTestId("today-skeleton-row")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "All topics" })).toBeTruthy();
  resolveFeed({ items: [] });
  await screen.findByText("Today's 5");
});
it("always starts with selected All topics, even with no tags or a failed initial read", async () => {
  (MobileAPI.feed as jest.Mock).mockRejectedValue(new Error("offline"));
  (MobileAPI.picks as jest.Mock).mockRejectedValue(new Error("offline"));
  home();
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
  await screen.findByText("Your reading lists will be back");
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
});
it("filters only the local tail, preserves topic on return and held/failed refresh, then resets on successful disappearance", async () => {
  const tagged = (id: string, tags: string[]) => item(id, { bookmark: bookmark(id, { cosmicTags: tags }) });
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [tagged("ai", ["AI", "Design"]), tagged("design", ["Design"]),
    item("pending", { type: "pending", bookmark: bookmark("pending", { processingStatus: "processing" }) })] });
  (MobileAPI.resume as jest.Mock).mockResolvedValue({ items: [{ bookmark: bookmark("resume"), progress: { percent: 50 } }] });
  const route = renderRouter({ _layout: () => <Stack screenOptions={{ headerShown: false }} />, index: HomeScreen, away: () => <Text>Away</Text> });
  await screen.findByText("Article ai");
  expect(screen.getAllByText(/^(All topics|AI|Design)$/).map(node => node.props.children)).toEqual(["All topics", "AI", "Design"]);
  const requests = (MobileAPI.feed as jest.Mock).mock.calls.length;
  fireEvent.press(screen.getByRole("button", { name: "AI" }));
  expect(screen.queryByText("Article design")).toBeNull();
  for (const title of ["Article pick", "Article resume", "Article pending", "0 of 1 done · 5 min left"]) expect(screen.getByText(title)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "All topics" }));
  expect(screen.getByText("Article design")).toBeTruthy();
  expect(MobileAPI.feed).toHaveBeenCalledTimes(requests);
  fireEvent.press(screen.getByRole("button", { name: "AI" }));
  act(() => router.push("/away"));
  await screen.findByText("Away");
  let finish!: (value: unknown) => void;
  (MobileAPI.feed as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  act(() => router.back());
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByRole("button", { name: "AI" }).props.accessibilityState.selected).toBe(true);
  await act(async () => finish({ items: [tagged("ai", ["AI"])] }));
  (MobileAPI.feed as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  await screen.findByText("You're offline. Previously loaded saves are shown. Connect to save changes.");
  expect(screen.getByRole("button", { name: "AI" }).props.accessibilityState.selected).toBe(true);
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [tagged("design", ["Design"])] });
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  await screen.findByText("Article design");
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "Design" }));
  route.unmount();
  home();
  await screen.findByText("Article design");
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
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

it("Home Paste opens the real Save screen with the copied URL and clipboard attribution", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ ...snapshot([]), computedAt: undefined });
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 0, unread: 0, archived: 0, inbox: 0, collections: [] });
  renderRouter({ index: HomeScreen, save: SaveScreen });
  fireEvent.press(await screen.findByText("Paste copied link"));
  expect((await screen.findByLabelText("Link")).props.value).toBe("https://copied.example/article");
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mockCaptureSave).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://copied.example/article", captureSource: "clipboard" })));
});
it("keeps black topics outside scrolling content and restores status chrome when a mounted Home tab blurs", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("tail", { bookmark: bookmark("tail", { cosmicTags: ["Design"] }) })] });
  const push = jest.spyOn(StatusBar, "pushStackEntry");
  const pop = jest.spyOn(StatusBar, "popStackEntry");
  try {
    renderRouter({ "(tabs)/_layout": TabLayout, "(tabs)/index": HomeScreen,
      "(tabs)/library": () => <Text>Library destination</Text>, "(tabs)/capture": () => null,
      "(tabs)/profile": () => null, "(tabs)/explore": () => null, save: () => null, search: () => <Text>Search destination</Text> });
    await screen.findByText("Article tail");
    expect(push).toHaveBeenLastCalledWith({ barStyle: "light-content", backgroundColor: colors.light.homeHeaderBg, translucent: false });
    const entry = push.mock.results.at(-1)!.value;
    expect(screen.UNSAFE_getByType(FlatList).findAllByType(Chip)).toHaveLength(0);
    const strip = screen.UNSAFE_getAllByType(ScrollView).find(node => node.props.horizontal)!;
    expect(StyleSheet.flatten(strip.props.style).backgroundColor).toBe(colors.light.homeHeaderBg);
    expect(screen.getAllByRole("button").slice(0, 3).map(node => node.props.accessibilityLabel ?? "All topics")).toEqual(["Search", "Your profile", "All topics"]);
    fireEvent.press(screen.getByRole("button", { name: "Design" }));
    fireEvent.press(screen.getByLabelText(/^Library, tab,/));
    await screen.findByText("Library destination");
    expect(pop).toHaveBeenCalledWith(entry);
    fireEvent.press(screen.getByLabelText(/^Home, tab,/));
    await screen.findByText("Article tail");
    expect(screen.getByRole("button", { name: "Design" }).props.accessibilityState.selected).toBe(true);
    expect(push.mock.calls.length).toBeGreaterThan(1);
    fireEvent.press(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search destination");
  } finally { push.mockRestore(); pop.mockRestore(); }
});
