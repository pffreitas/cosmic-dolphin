import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import BookmarkDetailScreen from "../bookmark/[id]";
import ReaderScreen from "../reader/[id]";
import { BookmarksAPI } from "@/lib/api";
import { MobileAPI } from "@/lib/mobile-api";
import { openBrowserAsync } from "expo-web-browser";

const mockParams: { id: string; mode?: string } = { id: "article" };
let mockUserId = "owner";
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock("@/lib/api", () => ({ BookmarksAPI: { findById: jest.fn() } }));
jest.mock("@/lib/mobile-api", () => ({ MobileAPI: {
  content: jest.fn(), picks: jest.fn(), read: jest.fn(), update: jest.fn(), refile: jest.fn(), collections: jest.fn(),
  progress: jest.fn(), highlights: jest.fn(), highlight: jest.fn(), removeHighlight: jest.fn(), saveProgress: jest.fn(), retry: jest.fn(), processingTimeline: jest.fn(),
} }));
jest.mock("@/lib/bookmark-cache", () => ({ cacheBookmarksInBackground: jest.fn(), getCachedBookmark: jest.fn(), removeCachedBookmark: jest.fn() }));
jest.mock("react-native-markdown-display", () => function Markdown({ children }: { children: React.ReactNode }) { return <>{children}</>; });
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

const article = { id: "article", userId: "owner", title: "A stored article", sourceUrl: "https://source.example/article", createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z", processingStatus: "completed", cosmicBriefSummary: "Brief only sentinel", cosmicKeyPoints: ["One real key point"], metadata: { wordCount: 1000 }, collectionId: "topic", collectionPath: [{ id: "topic", name: "Reading" }] };
const content = { blocks: [{ kind: "heading", text: "Article heading" }, { kind: "paragraph", text: "Genuine stored article text." }], wordCount: 6, source: "extracted", updatedAt: new Date() };
beforeEach(() => {
  jest.clearAllMocks(); delete mockParams.mode; mockParams.id = "article"; mockUserId = "owner";
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(article);
  (MobileAPI.content as jest.Mock).mockResolvedValue(content);
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.progress as jest.Mock).mockResolvedValue(null);
  (MobileAPI.highlights as jest.Mock).mockResolvedValue([]);
  (MobileAPI.read as jest.Mock).mockResolvedValue({});
});
afterEach(() => jest.restoreAllMocks());
it("offers the real Brief and Read views without passing the brief off as article text", async () => {
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Brief only sentinel");
  expect(view.getByText(/One real key point/)).toBeTruthy();
  fireEvent.press(view.getByRole("tab", { name: "Read" }));
  expect(await view.findByText("Genuine stored article text.")).toBeTruthy();
  expect(view.queryByText("Brief only sentinel")).toBeNull();
  expect(view.getByText("Article heading").props.selectable).toBe(true);
});
it("opens the actual saved URL in the in-app browser from Original", async () => {
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Brief only sentinel");
  fireEvent.press(view.getByRole("tab", { name: "Original" }));
  fireEvent.press(view.getByText("Open source.example"));
  await waitFor(() => expect(openBrowserAsync).toHaveBeenCalledWith(article.sourceUrl));
  expect(view.queryByText("Genuine stored article text.")).toBeNull();
});
it("opens a Read deep link directly in the genuine article view", async () => {
  mockParams.mode = "read";
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("Genuine stored article text.")).toBeTruthy();
  expect(view.getByRole("tab", { name: "Read" }).props.accessibilityState.selected).toBe(true);
  expect(view.queryByText("Brief only sentinel")).toBeNull();
});
it("opens an Original deep link in the source view", async () => {
  mockParams.mode = "original";
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("Open source.example")).toBeTruthy();
  expect(view.getByRole("tab", { name: "Original" }).props.accessibilityState.selected).toBe(true);
});
it("redirects a legacy reader link to the bookmark Read mode without adding a navigation page", async () => {
  render(<ReaderScreen />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/bookmark/[id]", params: { id: "article", mode: "read" } }));
});
it("marks the current pick done, retains the count and Undo, and voluntarily replaces it with the next undone original slot", async () => {
  const pick = (id: string, position: number, readAt?: Date) => ({ position, reason: `Original reason ${position}`, bookmark: { ...article, id, createdAt: new Date(article.createdAt), updatedAt: new Date(article.updatedAt), readAt } });
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ items: [pick("already-done", 5, new Date()), pick("next-visible", 4), pick("article", 1)] });
  (MobileAPI.read as jest.Mock).mockResolvedValue({});
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Mark done"));
  expect(await view.findByText("Done · 2 of 3")).toBeTruthy();
  expect(view.getByText("Undo")).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await waitFor(() => expect(MobileAPI.read).toHaveBeenCalledWith("article", true, "owner"));
  fireEvent.press(view.getByText("Next pick"));
  expect(mockRouter.replace).toHaveBeenCalledWith("/bookmark/next-visible");
});
it("finishes the last visible original pick with All N done and Back, ignoring hidden and removed slots", async () => {
  const pick = (id: string, position: number, extra = {}) => ({ position, reason: "Original reason", bookmark: { ...article, id, createdAt: new Date(article.createdAt), updatedAt: new Date(article.updatedAt), ...extra } });
  (MobileAPI.picks as jest.Mock).mockResolvedValue({ items: [pick("article", 1), pick("done", 3, { readAt: new Date() }), pick("hidden", 4, { laterUntil: new Date(Date.now() + 86400000) }), pick("archived", 5, { isArchived: true })] });
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Mark done"));
  expect(await view.findByText("All 2 done")).toBeTruthy();
  expect(view.queryByText("Next pick")).toBeNull();
  fireEvent.press(view.getByText("Back"));
  expect(mockRouter.back).toHaveBeenCalled();
});
it("uses Done, reversible Undo and Back outside today's set, never All 0 done", async () => {
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Mark done"));
  expect(await view.findByText("Done")).toBeTruthy();
  expect(view.queryByText("All 0 done")).toBeNull();
  expect(view.queryByText("Next pick")).toBeNull();
  await waitFor(() => expect(MobileAPI.read).toHaveBeenCalledWith("article", true, "owner"));
  fireEvent.press(view.getByText("Undo"));
  expect(await view.findByText("Mark done")).toBeTruthy();
  await waitFor(() => expect(MobileAPI.read).toHaveBeenLastCalledWith("article", false, "owner"));
});
it("shows the specified unavailable full-text state and opens the original after content 404", async () => {
  mockParams.mode = "read";
  (MobileAPI.content as jest.Mock).mockRejectedValue({ response: { status: 404 } });
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("Full text isn't available for this save.")).toBeTruthy();
  fireEvent.press(view.getByText("Open original"));
  await waitFor(() => expect(openBrowserAsync).toHaveBeenCalledWith(article.sourceUrl));
  expect(view.queryByText("Brief only sentinel")).toBeNull();
});
it("keeps a cached brief usable offline and asks to connect in Read, never displaying it as full text", async () => {
  const { getCachedBookmark } = require("@/lib/bookmark-cache");
  (BookmarksAPI.findById as jest.Mock).mockRejectedValue(new Error("offline"));
  getCachedBookmark.mockResolvedValue(article);
  (MobileAPI.content as jest.Mock).mockRejectedValue(new Error("offline"));
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("Brief only sentinel")).toBeTruthy();
  fireEvent.press(view.getByRole("tab", { name: "Read" }));
  expect(await view.findByText("Connect to load the full text.")).toBeTruthy();
  expect(view.queryByText("Brief only sentinel")).toBeNull();
});
it("shows full-text loading until content resolves instead of claiming it is unavailable", async () => {
  mockParams.mode = "read";
  let resolve!: (value: unknown) => void;
  (MobileAPI.content as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByLabelText("Loading full text")).toBeTruthy();
  expect(view.queryByText("Full text isn't available for this save.")).toBeNull();
  await act(async () => resolve(content));
  expect(await view.findByText("Genuine stored article text.")).toBeTruthy();
});
it("identifies a private description-only brief without fetching or claiming an article", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, isPrivateLink: true, metadata: { privateLink: { userDescription: "Owner description" } } });
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("From your description; no article text was fetched.")).toBeTruthy();
  expect(MobileAPI.content).not.toHaveBeenCalled();
  expect(view.queryByText(/Summarised from the full article/)).toBeNull();
  expect(view.queryByText(/Paste the text/)).toBeNull();
  fireEvent.press(view.getByRole("tab", { name: "Read" }));
  expect(await view.findByText("Full text isn't available for this save.")).toBeTruthy();
});
it.each(["extracted", "pasted"])("identifies the actual %s stored source in Brief provenance", async source => {
  (MobileAPI.content as jest.Mock).mockResolvedValue({ ...content, source });
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText(source === "pasted" ? "Summarised from the text you pasted · source.example" : "Summarised from the full article (6 words) · source.example")).toBeTruthy();
});
it("shows actual processing phases for a no-brief save without guessing from metadata", async () => {
  const pending = { ...article, processingStatus: "processing", cosmicBriefSummary: null, cosmicSummary: null, cosmicKeyPoints: [], metadata: { openGraph: { description: "HEADLINE_GUESS_SENTINEL" } } };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(pending);
  (MobileAPI.processingTimeline as jest.Mock).mockResolvedValue({ bookmark: pending, events: [{ kind: "phase", phase: "fetch", status: "completed", sequence: 1 }, { kind: "phase", phase: "extract", status: "running", sequence: 2 }], pollAfterMs: 5000 });
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("Fetched page")).toBeTruthy();
  expect(view.getByText("Extracting content…")).toBeTruthy();
  expect(view.getByText("Summarising")).toBeTruthy();
  expect(view.queryByText("HEADLINE_GUESS_SENTINEL")).toBeNull();
});
it("adds an owner-only private note optimistically through the existing owner PATCH", async () => {
  let accept!: (value: unknown) => void;
  (MobileAPI.update as jest.Mock).mockReturnValue(new Promise(resolve => { accept = resolve; }));
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Add a note"));
  fireEvent.changeText(view.getByLabelText("Why you saved it"), "Private reason for saving");
  fireEvent.press(view.getByText("Save note"));
  expect(await view.findByText("Private reason for saving")).toBeTruthy();
  await waitFor(() => expect(MobileAPI.update).toHaveBeenCalledWith("article", { userNote: "Private reason for saving" }, undefined, "owner"));
  await act(async () => accept({}));
  expect(view.queryByLabelText("Why you saved it")).toBeNull();
});
it("edits a saved note and explicitly clears it with null", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, userNote: "Original private note" });
  (MobileAPI.update as jest.Mock).mockResolvedValue({});
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Edit note"));
  expect(view.getByLabelText("Why you saved it").props.value).toBe("Original private note");
  fireEvent.changeText(view.getByLabelText("Why you saved it"), "Edited private note");
  fireEvent.press(view.getByText("Save note"));
  await waitFor(() => expect(MobileAPI.update).toHaveBeenCalledWith("article", { userNote: "Edited private note" }, undefined, "owner"));
  fireEvent.press(view.getByText("Edit note"));
  fireEvent.press(view.getByText("Clear note"));
  expect(await view.findByText("Add a note")).toBeTruthy();
  await waitFor(() => expect(MobileAPI.update).toHaveBeenLastCalledWith("article", { userNote: null }, undefined, "owner"));
});
it("accepts 500 note characters and refuses 501 without truncating the draft", async () => {
  (MobileAPI.update as jest.Mock).mockResolvedValue({});
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Add a note"));
  fireEvent.changeText(view.getByLabelText("Why you saved it"), "n".repeat(501));
  fireEvent.press(view.getByText("Save note"));
  expect(MobileAPI.update).not.toHaveBeenCalled();
  expect(view.getByLabelText("Why you saved it").props.value).toHaveLength(501);
  fireEvent.changeText(view.getByLabelText("Why you saved it"), "n".repeat(500));
  fireEvent.press(view.getByText("Save note"));
  await waitFor(() => expect(MobileAPI.update).toHaveBeenCalledWith("article", { userNote: "n".repeat(500) }, undefined, "owner"));
});
it("never shows another owner's note or private reader controls on an article page", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, userId: "another-owner", userNote: "PRIVATE_OTHER_OWNER_SENTINEL", isPublic: true });
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Brief only sentinel");
  for (const label of ["PRIVATE_OTHER_OWNER_SENTINEL", "Add a note", "Mark done", "Later"]) expect(view.queryByText(label)).toBeNull();
  expect(MobileAPI.content).not.toHaveBeenCalled();
});
it("discards an open private note draft when the signed-in account changes", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, userNote: "PRIVATE_PRIOR_ACCOUNT_DRAFT" });
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Edit note"));
  expect(view.getByLabelText("Why you saved it").props.value).toBe("PRIVATE_PRIOR_ACCOUNT_DRAFT");
  mockUserId = "next-owner"; mockParams.id = "next-article";
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, id: "next-article", userId: "next-owner", title: "Next account's save" });
  view.rerender(<BookmarkDetailScreen />);
  await view.findByText("Next account's save");
  expect(view.queryByLabelText("Why you saved it")).toBeNull();
  expect(view.queryByDisplayValue("PRIVATE_PRIOR_ACCOUNT_DRAFT")).toBeNull();
  expect(MobileAPI.update).not.toHaveBeenCalled();
});
it("opens Move from the filing breadcrumb and reuses the reversible topic mutation", async () => {
  (MobileAPI.collections as jest.Mock).mockResolvedValue([{ id: "science", name: "Science" }]);
  (MobileAPI.refile as jest.Mock).mockResolvedValue({});
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByRole("button", { name: "Reading, Move to topic" }));
  fireEvent.press(await view.findByText("Science"));
  expect(await view.findByText("Moved to Science. Cosmic won't move it again.")).toBeTruthy();
  await waitFor(() => expect(MobileAPI.refile).toHaveBeenCalledWith("article", "science", "owner"));
  expect(view.getByRole("button", { name: "Science, Move to topic" })).toBeTruthy();
  fireEvent.press(view.getByText("Undo"));
  await waitFor(() => expect(MobileAPI.refile).toHaveBeenLastCalledWith("article", "topic", "owner"));
  expect(view.getByRole("button", { name: "Reading, Move to topic" })).toBeTruthy();
});
it("opens the existing owner menu and its Move sheet from the reader", async () => {
  (MobileAPI.collections as jest.Mock).mockResolvedValue([]);
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByLabelText("More actions"));
  fireEvent.press(view.getByText("Move to topic…"));
  expect(await view.findByText("Inbox")).toBeTruthy();
});
it("offers Later in the growing reading bar and reuses the four reversible time options", async () => {
  (MobileAPI.update as jest.Mock).mockResolvedValue({});
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Later"));
  for (const option of ["Tonight", "Tomorrow morning", "This weekend", "Next week"]) expect(view.getByText(option)).toBeTruthy();
  fireEvent.press(view.getByText("Tomorrow morning"));
  await waitFor(() => expect(MobileAPI.update).toHaveBeenCalledWith("article", { laterUntil: expect.any(Date) }, undefined, "owner"));
  fireEvent.press(view.getByText("Undo"));
  await waitFor(() => expect(MobileAPI.update).toHaveBeenLastCalledWith("article", { laterUntil: null }, undefined, "owner"));
});
it("shows Move loading, then Inbox when no topics exist", async () => {
  let finish!: (value: unknown) => void;
  (MobileAPI.collections as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByRole("button", { name: "Reading, Move to topic" }));
  expect(await view.findByLabelText("Loading content")).toBeTruthy();
  expect(view.queryByText("Inbox")).toBeNull();
  await act(async () => finish([]));
  expect(await view.findByText("Inbox")).toBeTruthy();
});
it("retains a failed or offline Move list with Retry and a usable Inbox option", async () => {
  (MobileAPI.collections as jest.Mock).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ id: "science", name: "Science" }]);
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByRole("button", { name: "Reading, Move to topic" }));
  expect(await view.findByText("Topics could not be loaded.")).toBeTruthy();
  expect(view.getByText("Inbox")).toBeTruthy();
  fireEvent.press(view.getByText("Retry"));
  expect(await view.findByText("Science")).toBeTruthy();
});
it("keeps unread processing saves in the phase state instead of offering the finished reading bar", async () => {
  const pending = { ...article, processingStatus: "processing", cosmicBriefSummary: null, cosmicSummary: null };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(pending);
  (MobileAPI.processingTimeline as jest.Mock).mockResolvedValue({ bookmark: pending, events: [], pollAfterMs: 5000 });
  const view = render(<BookmarkDetailScreen />);
  await view.findByLabelText("Processing phases");
  expect(view.queryByText("Mark done")).toBeNull();
  expect(view.queryByText("Later")).toBeNull();
});
it("retains generic load/retry and completed no-brief states without metadata guesses", async () => {
  const { getCachedBookmark } = require("@/lib/bookmark-cache");
  getCachedBookmark.mockResolvedValue(null);
  (BookmarksAPI.findById as jest.Mock).mockRejectedValueOnce(new Error("The save could not be loaded.")).mockResolvedValueOnce({ ...article, cosmicBriefSummary: null, cosmicSummary: null, metadata: { openGraph: { description: "GUESS_SENTINEL" } } });
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Something went wrong");
  fireEvent.press(view.getByText("Try again"));
  expect(await view.findByText("No brief is available yet. You can still open the original.")).toBeTruthy();
  expect(view.queryByText("GUESS_SENTINEL")).toBeNull();
});
it("retains private highlights from the old brief even when they cannot be placed in the article", async () => {
  mockParams.mode = "read";
  (MobileAPI.highlights as jest.Mock).mockResolvedValue([{ id: "old-highlight", quote: "Old brief passage, no longer in this article", note: "Private highlight note" }]);
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Genuine stored article text.");
  fireEvent.press(view.getByLabelText("Your highlights"));
  expect(await view.findByText("Old brief passage, no longer in this article")).toBeTruthy();
  expect(view.getByText("Private highlight note")).toBeTruthy();
});
it("applies the existing device reading appearance to uncapped selectable article text", async () => {
  mockParams.mode = "read";
  const view = render(<PreferencesProvider><BookmarkDetailScreen /></PreferencesProvider>);
  const text = await view.findByText("Genuine stored article text.");
  const before = StyleSheet.flatten(text.props.style).fontSize;
  fireEvent.press(view.getByLabelText("Reading appearance"));
  fireEvent.press(view.getByText("Larger"));
  expect(StyleSheet.flatten(view.getByText("Genuine stored article text.").props.style).fontSize).toBeGreaterThan(before);
  expect(view.getByText("Genuine stored article text.").props.maxFontSizeMultiplier).toBeUndefined();
  expect(view.getByText("Genuine stored article text.").props.selectable).toBe(true);
});
it("restores monotonic reading progress and preserves its maximum when scrolling upward", async () => {
  mockParams.mode = "read";
  (MobileAPI.progress as jest.Mock).mockResolvedValue({ percent: 70, scrollOffset: 140 });
  (MobileAPI.saveProgress as jest.Mock).mockResolvedValue({ progress: { percent: 70 } });
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Genuine stored article text.");
  expect(await view.findByLabelText("70% read")).toBeTruthy();
  fireEvent.scroll(view.getByLabelText("Saved article"), { nativeEvent: { contentOffset: { y: 20 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 500 } } });
  expect(view.getByLabelText("70% read")).toBeTruthy();
  view.unmount();
  await waitFor(() => expect(MobileAPI.saveProgress).toHaveBeenCalledWith("article", 70, 20));
});
it("keeps old private highlights accessible even when the Read content is unavailable", async () => {
  mockParams.mode = "read";
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, isPrivateLink: true });
  (MobileAPI.highlights as jest.Mock).mockResolvedValue([{ id: "private-highlight", quote: "Earlier private brief passage" }]);
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Full text isn't available for this save.");
  fireEvent.press(view.getByLabelText("Your highlights"));
  expect(await view.findByText("Earlier private brief passage")).toBeTruthy();
});
it("rolls back a failed optimistic note edit with the required connection toast", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, userNote: "Original note" });
  let reject!: (reason: unknown) => void;
  (MobileAPI.update as jest.Mock).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Edit note"));
  fireEvent.changeText(view.getByLabelText("Why you saved it"), "Changed note");
  fireEvent.press(view.getByText("Save note"));
  await view.findByText("Changed note");
  await act(async () => reject(new Error("offline")));
  expect(await view.findByText("Original note")).toBeTruthy();
  expect(view.getByText("Change was not saved. Check your connection.")).toBeTruthy();
});
it("rolls back a failed optimistic Move with the required connection toast", async () => {
  (MobileAPI.collections as jest.Mock).mockResolvedValue([{ id: "science", name: "Science" }]);
  let reject!: (reason: unknown) => void;
  (MobileAPI.refile as jest.Mock).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByRole("button", { name: "Reading, Move to topic" }));
  fireEvent.press(await view.findByText("Science"));
  await view.findByRole("button", { name: "Science, Move to topic" });
  await act(async () => reject(new Error("offline")));
  expect(await view.findByRole("button", { name: "Reading, Move to topic" })).toBeTruthy();
  expect(view.getByText("Change was not saved. Check your connection.")).toBeTruthy();
});
it("retains Move Undo when the bookmark is already done", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, readAt: new Date().toISOString(), isRead: true });
  (MobileAPI.collections as jest.Mock).mockResolvedValue([]);
  (MobileAPI.refile as jest.Mock).mockResolvedValue({});
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByRole("button", { name: "Reading, Move to topic" }));
  fireEvent.press(await view.findByText("Inbox"));
  await view.findByText("Moved to Inbox. Cosmic won't move it again.");
  fireEvent.press(view.getByText("Undo"));
  await waitFor(() => expect(MobileAPI.refile).toHaveBeenLastCalledWith("article", "topic", "owner"));
});
it("does not reduce local progress when a late read arrives after changing tabs", async () => {
  mockParams.mode = "read";
  (MobileAPI.progress as jest.Mock).mockResolvedValue({ percent: 70, scrollOffset: 140 });
  let accept!: (value: unknown) => void;
  (MobileAPI.saveProgress as jest.Mock).mockReturnValue(new Promise(resolve => { accept = resolve; }));
  const view = render(<BookmarkDetailScreen />);
  await view.findByLabelText("70% read");
  fireEvent.scroll(view.getByLabelText("Saved article"), { nativeEvent: { contentOffset: { y: 450 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 500 } } });
  expect(view.getByLabelText("90% read")).toBeTruthy();
  fireEvent.press(view.getByRole("tab", { name: "Brief" }));
  fireEvent.press(view.getByRole("tab", { name: "Read" }));
  await waitFor(() => expect(MobileAPI.progress).toHaveBeenCalledTimes(2));
  expect(view.getByLabelText("90% read")).toBeTruthy();
  await act(async () => accept({ progress: { percent: 90 } }));
});
it("ignores a late previous bookmark response after navigation replaces the page", async () => {
  let finishOld!: (value: unknown) => void;
  (BookmarksAPI.findById as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce({ ...article, id: "next", title: "Next genuine save" });
  const view = render(<BookmarkDetailScreen />);
  await waitFor(() => expect(BookmarksAPI.findById).toHaveBeenCalledWith("article"));
  mockParams.id = "next";
  view.rerender(<BookmarkDetailScreen />);
  await view.findByText("Next genuine save");
  await act(async () => finishOld(article));
  expect(view.getByText("Next genuine save")).toBeTruthy();
  expect(view.queryByText("A stored article")).toBeNull();
});
it("loads genuine full text when reported processing completes after an initial content 404", async () => {
  mockParams.mode = "read";
  const pending = { ...article, processingStatus: "processing", cosmicBriefSummary: null };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(pending);
  let complete!: (value: unknown) => void;
  (MobileAPI.processingTimeline as jest.Mock).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  (MobileAPI.content as jest.Mock).mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValueOnce(content);
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Full text isn't available for this save.");
  await act(async () => complete({ bookmark: article, events: [] }));
  expect(await view.findByText("Genuine stored article text.")).toBeTruthy();
  expect(view.queryByText("Full text isn't available for this save.")).toBeNull();
});
it("keeps accepted Done when an earlier picks read completes with unread data", async () => {
  let finishPicks!: (value: unknown) => void;
  (MobileAPI.picks as jest.Mock).mockReturnValue(new Promise(resolve => { finishPicks = resolve; }));
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Mark done"));
  await waitFor(() => expect(MobileAPI.read).toHaveBeenCalledWith("article", true, "owner"));
  await act(async () => finishPicks({ items: [{ position: 1, reason: "Original reason", bookmark: { ...article, createdAt: new Date(article.createdAt), updatedAt: new Date(article.updatedAt) } }] }));
  expect(await view.findByText("All 1 done")).toBeTruthy();
  expect(view.queryByText("Mark done")).toBeNull();
});
it("ignores late full text from the previous save after page replacement", async () => {
  mockParams.mode = "read";
  let oldContent!: (value: unknown) => void;
  (MobileAPI.content as jest.Mock).mockReturnValueOnce(new Promise(resolve => { oldContent = resolve; })).mockResolvedValueOnce({ ...content, blocks: [{ kind: "paragraph", text: "Next save full text" }] });
  const view = render(<BookmarkDetailScreen />);
  await view.findByLabelText("Loading full text");
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, id: "next" });
  mockParams.id = "next";
  view.rerender(<BookmarkDetailScreen />);
  await view.findByText("Next save full text");
  await act(async () => oldContent(content));
  expect(view.getByText("Next save full text")).toBeTruthy();
  expect(view.queryByText("Genuine stored article text.")).toBeNull();
});
