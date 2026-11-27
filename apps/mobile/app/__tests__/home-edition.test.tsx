import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, waitFor, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { FlatList, RefreshControl, Text } from "react-native";
import HomeScreen from "../(tabs)/index";
import { MobileAPI } from "@/lib/mobile-api";
import type { Bookmark, FeedItem } from "@cosmic-dolphin/api-client";
const mockSave = jest.fn(async () => "capture");
const mockAcknowledge = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "reader", email: "reader@example.invalid", user_metadata: { full_name: "Paulo Freitas" } } }) }));
jest.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ appearance: "light" }) }));
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ captures: [], save: mockSave, confirm: jest.fn(), acknowledge: mockAcknowledge, revision: 0, drain: jest.fn(async () => {}) }) }));
jest.mock("@/lib/mobile-api", () => ({ nativeBookmark: (value: unknown) => value, MobileAPI: {
  feed: jest.fn(), picks: jest.fn(), counts: jest.fn(), resume: jest.fn(), collections: jest.fn(), like: jest.fn(), saveRecommendation: jest.fn(), comments: jest.fn(), comment: jest.fn(), digestLike: jest.fn(), digestShare: jest.fn(),
} }));
const bookmark = (id: string, overrides: Partial<Bookmark> = {}): Bookmark => ({ id, userId: "reader", title: `Article ${id}`, sourceUrl: `https://${id}.example/article`, createdAt: new Date(), updatedAt: new Date(), processingStatus: "completed", cosmicBriefSummary: `Summary ${id}`, metadata: { readingTime: 5 }, ...overrides } as Bookmark);
const item = (id: string, overrides: Partial<FeedItem> = {}): FeedItem => ({ type: "own_save", bookmark: bookmark(id), ...overrides });
function home() { return renderRouter({ index: HomeScreen, library: () => <Text>Library destination</Text>, save: () => <Text>Save destination</Text>, search: () => <Text>Search destination</Text>, explore: () => <Text>Explore destination</Text>, "bookmark/[id]": () => <Text>Bookmark destination</Text> }); }
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks();
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("lead"), item("row")], computedAt: new Date() });
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 2, unread: 2, archived: 0, inbox: 0, collections: [] });
  (MobileAPI.resume as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.collections as jest.Mock).mockResolvedValue([]);
});
it("renders the web edition and server scopes instead of topic chips and daily picks", async () => {
  home();
  expect(await screen.findByText("Article lead")).toBeTruthy();
  expect(screen.getByRole("header", { name: /Good .*Paulo/ })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "For you" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "Following" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Unread" })).toBeTruthy();
  expect(screen.queryByText("Today's 5")).toBeNull();
  expect(screen.queryByText("All topics")).toBeNull();
  expect(MobileAPI.picks).not.toHaveBeenCalled();
});
it("keeps all ranked items, without the old ten-item cap", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: Array.from({ length: 15 }, (_, n) => item(String(n))), computedAt: new Date() });
  home();
  expect(await screen.findByText("Article 0")).toBeTruthy();
  const list = screen.UNSAFE_getByType(FlatList);
  expect(list.props.data).toHaveLength(14);
  expect(list.props.data[13].bookmark.id).toBe("14");
  expect(screen.getByText("More for you")).toBeTruthy();
});
it("fetches Following and ignores a held response after switching to Unread", async () => {
  let finish!: (value: unknown) => void;
  (MobileAPI.feed as jest.Mock).mockImplementation((scope: string) => scope === "following" ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ items: [item(scope)], computedAt: new Date() }));
  home(); await screen.findByText("Article for_you");
  fireEvent.press(screen.getByRole("radio", { name: "Following" }));
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.press(screen.getByRole("radio", { name: "Unread" }));
  await screen.findByText("Article unread");
  await act(async () => finish({ items: [item("stale-following")], computedAt: new Date() }));
  expect(screen.queryByText("Article stale-following")).toBeNull();
  expect(screen.getByRole("radio", { name: "Unread" }).props.accessibilityState.checked).toBe(true);
});
it("paginates For you and deduplicates reappearing saves", async () => {
  (MobileAPI.feed as jest.Mock).mockImplementation((_scope, cursor) => Promise.resolve(cursor ? { items: [item("lead"), item("next")] } : { items: [item("lead")], nextCursor: "next", computedAt: new Date() }));
  home(); await screen.findByText("Article lead");
  fireEvent(screen.UNSAFE_getByType(FlatList), "endReached");
  await screen.findByText("Article next");
  expect(screen.getAllByText("Article lead")).toHaveLength(1);
  expect(MobileAPI.feed).toHaveBeenCalledWith("for_you", "next");
});
it("presents continue-reading before the ranked lead, preserving reading progress", async () => {
  (MobileAPI.resume as jest.Mock).mockResolvedValue({ items: [{ bookmark: bookmark("resume"), progress: { percent: 60 } }] });
  home(); await screen.findByText("Article lead");
  expect(screen.getByText("Pick up where you left off")).toBeTruthy();
  expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(60);
  expect(screen.getByText("2 min left")).toBeTruthy();
});
it("puts server-pending saves into Saving now and acknowledges loaded ids", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("pending", { type: "pending", bookmark: bookmark("pending", { processingStatus: "processing" }) }), item("lead")] });
  home(); await screen.findByText("Article lead");
  expect(screen.getByText("Article pending")).toBeTruthy();
  expect(mockAcknowledge).toHaveBeenCalledWith(expect.arrayContaining(["pending", "lead"]));
  expect(screen.queryByTestId("feed-card-pending")).toBeNull();
});
it("keeps ranking reasons behind an explicit disclosure", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [item("lead", { rankingReason: "The exact server-written reason." })] });
  home(); await screen.findByText("Article lead");
  expect(screen.queryByText("The exact server-written reason.")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Why this appeared" }));
  expect(screen.getByText("The exact server-written reason.")).toBeTruthy();
});
it("saves directly from the omnibox and keeps keyword search separate", async () => {
  const route = home(); await screen.findByText("Article lead");
  const input = screen.getByLabelText("Paste a link to save it, or search your library");
  fireEvent.changeText(input, "https://example.com/article");
  fireEvent(input, "submitEditing");
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://example.com/article" })));
  expect(input.props.value).toBe("");
  fireEvent.changeText(input, "agent memory"); fireEvent(input, "submitEditing");
  await screen.findByText("Search destination"); expect(route.getPathname()).toBe("/search");
});
it("validates the first-save field, then submits the URL through the real capture boundary", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 0, archived: 0 });
  home(); await screen.findByText("Save your first link.");
  fireEvent.press(screen.getByRole("button", { name: "Save link" }));
  expect(screen.getByText(/That doesn't look like a link/)).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("Link to save"), "example.com/article");
  fireEvent.press(screen.getByRole("button", { name: "Save link" }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://example.com/article" })));
});
it("shows a scope-specific empty state and keeps scope controls reachable", async () => {
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [] });
  home(); await screen.findByText("Nothing ranked for you right now.");
  fireEvent.press(screen.getByRole("radio", { name: "Following" }));
  expect(await screen.findByText("Nobody you follow has shared anything yet.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Find people on Explore" }));
  expect(await screen.findByText("Explore destination")).toBeTruthy();
});
it("retains cached feed on refresh failure and disables network social actions", async () => {
  home(); await screen.findByText("Article lead");
  (MobileAPI.feed as jest.Mock).mockRejectedValue(new Error("offline"));
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  await screen.findByText(/You're offline/);
  expect(screen.getByText("Article lead")).toBeTruthy();
  expect(within(screen.getByTestId("feed-card-lead")).getByRole("button", { name: "Like on Article lead" }).props.accessibilityState.disabled).toBe(true);
});
it("rolls back a failed like instead of inventing social state", async () => {
  (MobileAPI.like as jest.Mock).mockRejectedValue(new Error("offline"));
  home(); await screen.findByText("Article lead");
  fireEvent.press(screen.getByRole("button", { name: "Like on Article lead" }));
  await screen.findByText("Couldn't update that like.");
  expect(MobileAPI.like).toHaveBeenCalledWith("lead", true, "reader");
  expect(screen.getByRole("button", { name: "Like on Article lead" }).props.accessibilityState.selected).toBe(false);
});
it("opens comments over the feed on request, posts as the owner and closes in place", async () => {
  const existing = { id: "c1", bookmarkId: "lead", body: "First thought", author: { id: "other", name: "Ada" }, createdAt: new Date(), updatedAt: new Date(), isEdited: false, isDeleted: false, isOwn: false, canEdit: false };
  (MobileAPI.comments as jest.Mock).mockResolvedValue({ comments: [existing] });
  (MobileAPI.comment as jest.Mock).mockResolvedValue({ ...existing, id: "c2", body: "Reply" });
  home(); await screen.findByText("Article lead");
  expect(MobileAPI.comments).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Comments on Article lead" }));
  expect(await screen.findByText("First thought")).toBeTruthy();
  expect(screen.getByText("1 comment")).toBeTruthy();
  expect(MobileAPI.comments).toHaveBeenCalledWith("lead", "reader");
  fireEvent.changeText(screen.getByLabelText("Your comment"), "  Reply ");
  fireEvent.press(screen.getByRole("button", { name: "Post comment" }));
  await waitFor(() => expect(MobileAPI.comment).toHaveBeenCalledWith("lead", "Reply", "reader"));
  await waitFor(() => expect(MobileAPI.comments).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("Your comment").props.value).toBe("");
  fireEvent.press(screen.getAllByRole("button", { name: "Close comments" })[0]);
  await waitFor(() => expect(screen.queryByText("First thought")).toBeNull());
  expect(screen.queryByText("Bookmark destination")).toBeNull();
});

it("keeps digest reactions owner-bound and acknowledges sharing before Saved", async () => {
  const digest = { id: "digest", title: "Across your saves", summary: "A sourced connection.", keyPoints: [], sources: [], coherence: 0.8, createdAt: new Date(), likeCount: 6, isLikedByCurrentUser: false, isPublic: false };
  (MobileAPI.feed as jest.Mock).mockResolvedValue({ items: [{ type: "digest", digest }], computedAt: new Date() });
  (MobileAPI.digestLike as jest.Mock).mockRejectedValue(new Error("offline"));
  let acknowledge!: (value: unknown) => void;
  (MobileAPI.digestShare as jest.Mock).mockImplementation(() => new Promise(resolve => { acknowledge = resolve; }));
  home(); await screen.findByText("Across your saves");
  fireEvent.press(screen.getByRole("button", { name: "Like on Across your saves" }));
  await screen.findByText("Couldn't update that like.");
  expect(MobileAPI.digestLike).toHaveBeenCalledWith("digest", true, "reader");
  expect(within(screen.getByRole("button", { name: "Like on Across your saves" })).getByText("6")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Save digest" }));
  await waitFor(() => expect(MobileAPI.digestShare).toHaveBeenCalledWith("digest", "reader"));
  expect(screen.queryByRole("button", { name: "Saved" })).toBeNull();
  await act(async () => acknowledge({ isPublic: true, shareUrl: "https://example.invalid/digest" }));
  expect(screen.getByRole("button", { name: "Saved" }).props.accessibilityState.disabled).toBe(true);
});
