import React, { useLayoutEffect } from "react";
import { act, fireEvent, waitFor, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { Stack } from "expo-router";
import { RefreshControl } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { CaptureProvider } from "@/contexts/CaptureContext";
import HomeScreen from "../(tabs)/index";

let mockSession: any;
let mockAuthChange: (event: string, session: any) => void;
jest.mock("@/lib/supabase", () => ({ supabase: { auth: {
  getSession: jest.fn(async () => ({ data: { session: mockSession } })),
  onAuthStateChange: jest.fn(callback => { mockAuthChange = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
} } }));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "cosmicdolphin:///" }));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("@/components/CopiedLink", () => ({ CopiedLink: () => null }));
jest.mock("@/lib/share-key-client", () => ({ shareKeys: { activate: jest.fn(), ensure: jest.fn(async () => {}) } }));

const session = (id: string) => ({ access_token: `fixture-${id}`, user: { id, email: `${id}@example.invalid`, user_metadata: {} } });
const bookmark = (id: string, owner: string, tag: string) => ({ id, userId: owner, title: `Article ${id}`, cosmicTags: [tag],
  sourceUrl: `https://example.invalid/${id}`, createdAt: "2026-11-12T10:00:00Z", updatedAt: "2026-11-12T10:00:00Z", processingStatus: "completed" });
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
let commits: { owner?: string; oldTopic: boolean; oldContent: boolean; allSelected?: boolean }[];
function CommitAudit() {
  const { user } = useAuth();
  useLayoutEffect(() => {
    if (user?.id !== "b") return;
    commits.push({ owner: user.id, oldTopic: !!screen.queryByRole("button", { name: "Private A" }),
      oldContent: screen.queryAllByText(/^(Article (a|pick-a|resume-a)|Private A reason|91 unread saves are in your Library\.)$/).length > 0,
      allSelected: screen.queryByRole("button", { name: "All topics" })?.props.accessibilityState.selected });
  });
  return null;
}
function Layout() {
  return <AuthProvider><PreferencesProvider><CaptureProvider><Stack screenOptions={{ headerShown: false }} /><CommitAudit /></CaptureProvider></PreferencesProvider></AuthProvider>;
}
const originalFetch = global.fetch;
beforeEach(async () => {
  await AsyncStorage.clear();
  mockSession = session("a"); commits = [];
  global.fetch = Object.assign(jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const owner = (init?.headers as Record<string, string>).Authorization.endsWith("fixture-a") ? "a" : "b";
    if (String(url).includes("/feed")) return response({ items: [{ type: "own_save", bookmark: bookmark(owner, owner, owner === "a" ? "Private A" : "B topic") }], nextCursor: "must-not-page" });
    if (String(url).includes("/picks/today")) return response({ localDate: "2026-11-12", refreshesAt: "2026-11-13T06:00:00Z", computedAt: "2026-11-12T10:00:00Z", items: [
      { position: 1, bookmark: bookmark(`pick-${owner}`, owner, "Pick topic"), reason: owner === "a" ? "Private A reason" : "B reason" },
    ] });
    if (String(url).includes("/continue-reading")) return response({ items: [{ bookmark: bookmark(`resume-${owner}`, owner, "Resume topic"), progress: { percent: 50 } }] });
    if (String(url).includes("/bookmarks/counts")) return response({ all: 91, unread: owner === "a" ? 91 : 1, archived: 0, inbox: 1, collections: [] });
    if (String(url).includes("/collections")) return response({ collections: [] });
    throw new Error(`Unexpected fixture request ${url}`);
  }), { preconnect: originalFetch.preconnect });
});
afterEach(() => { global.fetch = originalFetch; });

it("fences selected topics and content synchronously at A→B, including an open sheet and held A refresh", async () => {
  renderRouter({ _layout: Layout, index: HomeScreen });
  await act(async () => {});
  await screen.findByText("Article a");
  fireEvent.press(screen.getByRole("button", { name: "Private A" }));
  const transport = global.fetch;
  let finish!: (value: Response) => void;
  global.fetch = Object.assign(jest.fn((url: string | URL | Request, init?: RequestInit) => String(url).includes("/feed") && (init?.headers as Record<string, string>).Authorization.endsWith("fixture-a")
    ? new Promise<Response>(resolve => { finish = resolve; }) : transport(url, init)), { preconnect: originalFetch.preconnect });
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.press(within(screen.getByTestId("feed-card-a")).getByRole("button", { name: "Later" }));
  expect(screen.getByText("Tomorrow morning")).toBeTruthy();
  await act(async () => { mockSession = session("b"); mockAuthChange("SIGNED_IN", mockSession); });
  await screen.findByText("Article b");
  expect(commits.length).toBeGreaterThan(0);
  expect(commits).toEqual(expect.arrayContaining([{ owner: "b", oldTopic: false, oldContent: false, allSelected: true }]));
  expect(commits.every(commit => !commit.oldTopic && !commit.oldContent && commit.allSelected)).toBe(true);
  expect(screen.queryByText("Tomorrow morning")).toBeNull();
  await act(async () => finish(response({ items: [{ type: "own_save", bookmark: bookmark("a", "a", "Private A") }] })));
  expect(screen.queryByText("Article a")).toBeNull();
  expect(screen.queryByRole("button", { name: "Private A" })).toBeNull();
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByText("Article b")).toBeTruthy();
  const feedCalls = jest.mocked(transport).mock.calls.filter(([url]) => String(url).includes("/feed"));
  expect(feedCalls).toHaveLength(2); // One initial read per owner; the held refresh bypasses this fixture.
  for (const [url] of feedCalls) {
    const query = new URL(String(url), "https://fixture.invalid").searchParams;
    expect(query.get("scope")).toBe("for_you");
    expect(query.get("limit")).toBe("15");
    expect(query.get("cursor")).toBeNull();
  }
});
it("ignores held old-owner action and Move-list completions without changing B or replaying the write", async () => {
  renderRouter({ _layout: Layout, index: HomeScreen });
  await act(async () => {});
  await screen.findByText("Article a");
  fireEvent.press(screen.getByRole("button", { name: "Private A" }));
  const transport = global.fetch;
  let finishRead!: (value: Response) => void;
  let finishTopics!: (value: Response) => void;
  const writes: string[] = [];
  global.fetch = Object.assign(jest.fn((url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/read")) {
      writes.push((init?.headers as Record<string, string>).Authorization);
      return new Promise<Response>(resolve => { finishRead = resolve; });
    }
    if (String(url).includes("/collections")) return new Promise<Response>(resolve => { finishTopics = resolve; });
    return transport(url, init);
  }), { preconnect: originalFetch.preconnect });
  // The real owner-bound controller keeps the optimistic write through navigation.
  fireEvent.press(within(screen.getByTestId("feed-card-a")).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(finishRead).toBeDefined());
  fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  // Undo is queued behind the acknowledged owner write, not rebound to B.
  fireEvent.press(within(screen.getByTestId("feed-card-a")).getByRole("button", { name: "More actions" }));
  fireEvent.press(screen.getByText("Move to topic…"));
  await waitFor(() => expect(finishTopics).toBeDefined());
  await act(async () => { mockSession = session("b"); mockAuthChange("SIGNED_IN", mockSession); });
  await screen.findByText("Article b");
  await act(async () => {
    finishTopics(response({ collections: [{ id: "a-topic", name: "Private A collection" }] }));
    finishRead(response({}));
  });
  expect(screen.queryByText("Private A collection")).toBeNull();
  expect(screen.queryByText("Article a")).toBeNull();
  expect(screen.queryByText("Marked done")).toBeNull();
  expect(screen.getByRole("button", { name: "All topics" }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByText("Article b")).toBeTruthy();
  expect(writes).toEqual(["Bearer fixture-a"]);
});
