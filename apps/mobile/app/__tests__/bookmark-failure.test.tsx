import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import BookmarkDetailScreen from "../bookmark/[id]";
import { CaptureStatus } from "@/components/CaptureStatus";
import { FeedCard } from "@/components/FeedCard";
import { BookmarksAPI } from "@/lib/api";
import { MobileAPI } from "@/lib/mobile-api";
import { openBrowserAsync } from "expo-web-browser";

const mockParams: { id: string; mode?: string; paste?: string; retry?: string } = { id: "article" };
let mockUserId = "owner";
let mockCaptures: any[] = [];
const mockCaptureActions = { retry: jest.fn(), remove: jest.fn(), updateBookmark: jest.fn(), acknowledge: jest.fn() };
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ ...mockCaptureActions, captures: mockCaptures, revision: 0 }) }));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock("@/lib/api", () => ({ BookmarksAPI: { findById: jest.fn() } }));
jest.mock("@/lib/mobile-api", () => ({ MobileAPI: {
  notInterested: jest.fn(), content: jest.fn(), picks: jest.fn(), read: jest.fn(), update: jest.fn(), refile: jest.fn(), collections: jest.fn(),
  progress: jest.fn(), highlights: jest.fn(), highlight: jest.fn(), removeHighlight: jest.fn(), saveProgress: jest.fn(), retry: jest.fn(), pasteContent: jest.fn(), processingTimeline: jest.fn(),
} }));
jest.mock("@/lib/bookmark-cache", () => ({ cacheBookmarksInBackground: jest.fn(), getCachedBookmark: jest.fn(), removeCachedBookmark: jest.fn() }));
jest.mock("react-native-markdown-display", () => function Markdown({ children }: { children: React.ReactNode }) { return <>{children}</>; });
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

const article = { id: "article", userId: "owner", title: "A stored article", sourceUrl: "https://source.example/article", createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z", processingStatus: "completed", cosmicBriefSummary: "Brief only sentinel", cosmicKeyPoints: ["One real key point"], metadata: { wordCount: 1000 }, collectionId: "topic", collectionPath: [{ id: "topic", name: "Reading" }] };
const content = { blocks: [{ kind: "heading", text: "Article heading" }, { kind: "paragraph", text: "Genuine stored article text." }], wordCount: 6, source: "extracted", updatedAt: new Date() };
beforeEach(() => {
  jest.clearAllMocks();
  Object.values(MobileAPI).forEach(mock => (mock as jest.Mock).mockReset());
  (openBrowserAsync as jest.Mock).mockResolvedValue({}); delete mockParams.mode; delete mockParams.paste; delete mockParams.retry; mockParams.id = "article"; mockUserId = "owner"; mockCaptures = [];
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

const reasons = [
  ["paywall", "it needs a subscription"], ["auth", "it asks you to sign in"],
  ["blocked", "the site didn't let Cosmic read it"], ["empty", "the page had no article text"],
  ["unsupported", "Cosmic can't read this kind of page yet"], ["unavailable", "the page wasn't available"],
  ["provider", "Cosmic couldn't reach it just now"],
] as const;
it.each(reasons)("shows %s safely on the failed page and in-place card", async (code, reason) => {
  const failed = { ...article, processingStatus: "failed", processingFailureCode: code, cosmicBriefSummary: "", cosmicSummary: "", cosmicKeyPoints: [], metadata: { openGraph: { description: "NO OG SUBSTITUTE" } } };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(failed);
  (MobileAPI.content as jest.Mock).mockRejectedValue({ response: { status: 404 } });
  const view = render(<BookmarkDetailScreen />);
  const copy = `Cosmic couldn't read this page because ${reason}. Your link is safe.`;
  expect(await view.findByText(copy)).toBeTruthy();
  expect(view.getByText("Nothing is guessed from the headline.")).toBeTruthy();
  expect(view.queryByText("NO OG SUBSTITUTE")).toBeNull();
  expect(view.getByText("Later")).toBeTruthy(); expect(view.getByText("Mark done")).toBeTruthy();
  expect(view.queryByText("Paste the text") !== null).toBe(code !== "provider");
  if (code === "provider") expect(view.getByText("Try again")).toBeTruthy();
  fireEvent.press(view.getAllByLabelText("Open original")[0]);
  await waitFor(() => expect(openBrowserAsync).toHaveBeenCalledWith(article.sourceUrl));
  view.unmount();
  const card = render(<FeedCard item={{ type: "own_save", bookmark: { ...failed, createdAt: new Date(failed.createdAt), updatedAt: new Date(failed.updatedAt) } } as any} actions={{ done: jest.fn(), later: jest.fn(), more: jest.fn() }} />);
  expect(card.getByText(copy)).toBeTruthy();
  expect(card.queryByText("Paste the text") !== null).toBe(code !== "provider");
  expect(card.getByText("Mark done")).toBeTruthy();
});

it("keeps legacy Retry, preserves private description-only saves, and refuses unsafe originals", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, processingStatus: "failed", cosmicBriefSummary: "", sourceUrl: "javascript:steal()" });
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("The brief could not be prepared. Your original link is still available.")).toBeTruthy();
  expect(view.getByText("Retry")).toBeTruthy();
  expect(view.queryByText("Paste the text")).toBeNull();
  fireEvent.press(view.getByLabelText("Open original"));
  expect(openBrowserAsync).not.toHaveBeenCalled();
  view.unmount();
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, isPrivateLink: true, processingStatus: "failed", processingFailureCode: "auth" });
  const privateView = render(<BookmarkDetailScreen />);
  expect(await privateView.findByText("From your description; no article text was fetched.")).toBeTruthy();
  expect(privateView.queryByText("Paste the text")).toBeNull();
  expect(privateView.getByText("Brief only sentinel")).toBeTruthy();
});

it("validates paste bounds, retains failed text for Retry, then shows pending and pasted-source brief", async () => {
  const failed = { ...article, processingStatus: "failed", processingFailureCode: "paywall", cosmicBriefSummary: "", cosmicSummary: "", cosmicKeyPoints: [] };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(failed);
  (MobileAPI.content as jest.Mock).mockRejectedValue({ response: { status: 404 } });
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Paste the text"));
  const input = await view.findByLabelText("Article text");
  for (const length of [199, 200, 100000, 100001]) {
    fireEvent.changeText(input, "x".repeat(length));
    expect(view.getByRole("button", { name: "Write the brief" }).props.accessibilityState.disabled).toBe(length < 200 || length > 100000);
  }
  const pasted = "Readable fictional article. ".repeat(10);
  fireEvent.changeText(input, pasted);
  (MobileAPI.pasteContent as jest.Mock).mockRejectedValueOnce(new Error("Offline"));
  fireEvent.press(view.getByText("Write the brief"));
  expect(await view.findByText("Change was not saved. Check your connection.")).toBeTruthy();
  expect(view.getByLabelText("Article text").props.value).toBe(pasted);
  const pending = { ...failed, processingStatus: "processing", processingFailureCode: null };
  (MobileAPI.pasteContent as jest.Mock).mockResolvedValue({ bookmark: pending });
  (MobileAPI.content as jest.Mock).mockResolvedValue({ ...content, source: "pasted" });
  let complete!: (result: any) => void;
  (MobileAPI.processingTimeline as jest.Mock).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.press(view.getByText("Retry"));
  expect(await view.findByText("Cosmic is reading the text you pasted")).toBeTruthy();
  expect(view.queryByLabelText("Article text")).toBeNull();
  expect(MobileAPI.pasteContent).toHaveBeenLastCalledWith("article", pasted, expect.anything(), "owner");
  await act(async () => complete({ bookmark: { ...pending, processingStatus: "completed", cosmicBriefSummary: "New pasted article brief" }, events: [], pollAfterMs: 5000 }));
  expect(await view.findByText("New pasted article brief")).toBeTruthy();
  expect(view.getByText("Summarised from the text you pasted · source.example")).toBeTruthy();
});

it("opens the card's paste intent on the current owner page and retries provider into pending", async () => {
  const failed = { ...article, processingStatus: "failed", processingFailureCode: "paywall", cosmicBriefSummary: "" };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(failed);
  mockParams.paste = "1";
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByLabelText("Article text")).toBeTruthy();
  view.unmount(); delete mockParams.paste;
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...failed, processingFailureCode: "provider" });
  (MobileAPI.retry as jest.Mock).mockResolvedValue({ bookmark: { ...failed, processingFailureCode: null, processingStatus: "processing" } });
  (MobileAPI.processingTimeline as jest.Mock).mockImplementation(() => new Promise(() => {}));
  const retryView = render(<BookmarkDetailScreen />);
  fireEvent.press(await retryView.findByText("Try again"));
  expect(await retryView.findByText("Cosmic is reading it. You can keep browsing while the brief is prepared.")).toBeTruthy();
  expect(MobileAPI.retry).toHaveBeenCalledWith("article", "owner", expect.anything());
  expect(retryView.queryByText("Paste the text")).toBeNull();
});

it("replaces an accepted failed capture in place while transport 400 stays a distinct unsent row", () => {
  const failed = { ...article, processingStatus: "failed", processingFailureCode: "paywall", cosmicBriefSummary: "" };
  const entry = { id: "capture", url: article.sourceUrl, userId: "owner", queuedAt: article.createdAt, attempts: 1, captureSource: "save_sheet", capturePlatform: "ios" };
  mockCaptures = [{ id: "capture", status: "saved", bookmark: failed, entry }];
  const done = jest.fn(), later = jest.fn();
  const view = render(<CaptureStatus failedActions={() => ({ done, later })} />);
  expect(view.getByText("Cosmic couldn't read this page because it needs a subscription. Your link is safe.")).toBeTruthy();
  expect(view.queryByText("Saved privately to your Library")).toBeNull();
  fireEvent.press(view.getByText("Mark done")); expect(done).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText("Later")); expect(later).toHaveBeenCalledTimes(1);
  view.unmount();
  mockCaptures = [{ id: "capture", status: "failed", entry: { ...entry, failure: "rejected" } }];
  const unsent = render(<CaptureStatus />);
  expect(unsent.getByText("Couldn't save this link")).toBeTruthy();
  expect(unsent.queryByText("Paste the text")).toBeNull(); expect(unsent.queryByText("Retry")).toBeNull();
  fireEvent.press(unsent.getByText("Remove")); expect(mockCaptureActions.remove).toHaveBeenCalledWith("capture");
});

it.each(["account", "page"])("clears paste drafts and fences late success on %s change without replay", async change => {
  const failed = { ...article, processingStatus: "failed", processingFailureCode: "paywall", cosmicBriefSummary: "" };
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue(failed);
  let resolve!: (result: any) => void;
  (MobileAPI.pasteContent as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(<BookmarkDetailScreen />);
  fireEvent.press(await view.findByText("Paste the text"));
  fireEvent.changeText(view.getByLabelText("Article text"), "PRIVATE DRAFT ".repeat(20));
  fireEvent.press(view.getByText("Write the brief"));
  await waitFor(() => expect(MobileAPI.pasteContent).toHaveBeenCalledTimes(1));
  if (change === "account") mockUserId = "next-owner"; else mockParams.id = "next-page";
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...failed, id: mockParams.id, userId: mockUserId, title: "Current save" });
  view.rerender(<BookmarkDetailScreen />);
  expect(await view.findByText("Current save")).toBeTruthy();
  expect(view.queryByLabelText("Article text")).toBeNull();
  await act(async () => resolve({ bookmark: { ...failed, processingStatus: "completed", cosmicBriefSummary: "LATE PRIVATE RESULT" } }));
  expect(view.queryByText("LATE PRIVATE RESULT")).toBeNull();
  fireEvent.press(view.getByText("Paste the text"));
  expect(view.getByLabelText("Article text").props.value).toBe("");
  expect(view.getByRole("button", { name: "Write the brief" }).props.accessibilityState.disabled).toBe(true);
  expect(MobileAPI.pasteContent).toHaveBeenCalledTimes(1);
});

it("shows the failed-page region in place of stale brief and article claims", async () => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, processingStatus: "failed", processingFailureCode: "empty", cosmicBriefSummary: "STALE BRIEF", cosmicSummary: "STALE SUMMARY" });
  const view = render(<BookmarkDetailScreen />);
  expect(await view.findByText("Nothing is guessed from the headline.")).toBeTruthy();
  expect(view.queryByText("STALE BRIEF")).toBeNull(); expect(view.queryByText("STALE SUMMARY")).toBeNull();
  expect(view.queryByRole("tab", { name: "Read" })).toBeNull();
  expect(view.queryByText(/Summarised from the full article/)).toBeNull();
  expect(view.getByText("Mark done")).toBeTruthy();
});

it.each(["Done", "Later", "Not for me"])("rolls back %s offline on a failed save through the existing controller without replay", async action => {
  (BookmarksAPI.findById as jest.Mock).mockResolvedValue({ ...article, processingStatus: "failed", processingFailureCode: "blocked", cosmicBriefSummary: "" });
  let reject!: (error: Error) => void;
  const failure = new Promise((_, fail) => { reject = fail; });
  (MobileAPI.read as jest.Mock).mockReturnValue(failure);
  (MobileAPI.update as jest.Mock).mockReturnValue(failure);
  const view = render(<BookmarkDetailScreen />);
  await view.findByText("Nothing is guessed from the headline.");
  if (action === "Done") fireEvent.press(view.getByText("Mark done"));
  else if (action === "Later") { fireEvent.press(view.getByText("Later")); fireEvent.press(await view.findByText("Tonight")); }
  else { fireEvent.press(view.getByLabelText("More actions")); fireEvent.press(await view.findByText("Not for me")); }
  await waitFor(() => expect(action === "Done" ? MobileAPI.read : MobileAPI.update).toHaveBeenCalledTimes(1));
  await act(async () => reject(new Error("offline")));
  expect(await view.findByText("Change was not saved. Check your connection.")).toBeTruthy();
  expect(view.getByText("Mark done")).toBeTruthy(); expect(view.getByText("Later")).toBeTruthy();
  expect(view.getByText("Nothing is guessed from the headline.")).toBeTruthy();
  expect(MobileAPI.notInterested).not.toHaveBeenCalled();
  view.rerender(<BookmarkDetailScreen />);
  expect(action === "Done" ? MobileAPI.read : MobileAPI.update).toHaveBeenCalledTimes(1);
});
