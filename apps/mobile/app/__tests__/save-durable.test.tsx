/* eslint-disable @typescript-eslint/no-require-imports -- Jest native module factories run before imports. */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RootLayout from "../_layout";
import { saveQueue } from "@/lib/save-queue";
import type { useCaptures } from "@/contexts/CaptureContext";

const mockReaderSession = { access_token: "fixture-jwt", user: { id: "reader" } };
let mockSession: any = mockReaderSession;
let mockAuthChange: (event: string, session: any) => void;
let mockPath = "/save";
let mockSaveParams: { url?: string; accountId?: string } = {};
let mockNavigate: (path: string) => void;
let mockCaptures: ReturnType<typeof useCaptures>;
let mockCaptureViews: { owner?: string; captureOwners: (string | undefined)[] }[];
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: {
    getSession: jest.fn(async () => ({ data: { session: mockSession } })),
    onAuthStateChange: jest.fn(callback => { mockAuthChange = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
  } },
}));
const mockHasUrl = jest.fn(async () => false);
const mockReadClipboard = jest.fn();
jest.mock("expo-clipboard", () => ({
  isPasteButtonAvailable: true, hasUrlAsync: () => mockHasUrl(), getStringAsync: () => mockReadClipboard(), getUrlAsync: () => mockReadClipboard(),
  ClipboardPasteButton: (props: any) => {
    const { Pressable, Text } = require("react-native");
    return <Pressable accessibilityRole="button" accessibilityLabel="Paste" onPress={() => props.onPress({ type: "text", text: "https://example.com/copied" })}><Text>Paste</Text></Pressable>;
  },
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("crypto").randomUUID() }));
jest.mock("react-native-reanimated", () => ({}));
jest.mock("expo-font", () => ({ useFonts: () => [true], isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock("expo-linking", () => ({
  addEventListener: () => ({ remove: jest.fn() }), getInitialURL: async () => null,
}));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "cosmicdolphin:///" }));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-share-intent", () => ({
  ShareIntentProvider: ({ children }: any) => children,
  useShareIntentContext: () => ({ hasShareIntent: false, resetShareIntent: jest.fn() }),
}));
jest.mock("expo-router", () => {
  const React = require("react");
  const router = { replace: (path: string) => mockNavigate(path), push: (path: string) => mockNavigate(path), back: jest.fn(), canGoBack: () => false };
  function Stack() {
    mockCaptures = require("@/contexts/CaptureContext").useCaptures();
    mockCaptureViews.push({ owner: require("@/contexts/AuthContext").useAuth().user?.id, captureOwners: mockCaptures.captures.map(value => value.entry.userId) });
    const [path, setPath] = React.useState(mockPath);
    mockNavigate = (next: string) => { mockPath = next; setPath(next); };
    if (path.startsWith("/(auth)")) return React.createElement(require("react-native").Text, {}, "Sign in");
    const Screen = path === "/save" ? require("../save").default : require("../(tabs)/index").default;
    return <Screen />;
  }
  Stack.Screen = function StackScreen() { return null; };
  return { Stack, useLocalSearchParams: () => mockSaveParams, useNavigation: () => ({ navigate: (path: string) => mockNavigate("/" + path) }), useRouter: () => router, usePathname: () => mockPath,
    useSegments: () => [mockPath.startsWith("/(auth)") ? "(auth)" : "(tabs)"], useFocusEffect: (effect: any) => React.useEffect(effect, [effect]) };
});

let requests: { body: any; authorization: string }[];
let bookmarks: Map<string, any>;
let completeRequest: () => void;
let killRequest: () => void;
let holdFirst: boolean;
const response = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
beforeEach(async () => {
  require("react-native").AppState.addEventListener.mockImplementation(() => ({ remove: jest.fn() }));
  await AsyncStorage.clear();
  mockSession = mockReaderSession;
  mockHasUrl.mockResolvedValue(false);
  mockReadClipboard.mockClear();
  mockPath = "/save";
  mockSaveParams = {};
  mockCaptureViews = [];
  requests = [];
  bookmarks = new Map();
  holdFirst = true;
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "POST" && String(url).endsWith("/bookmarks")) {
      const body = JSON.parse(init.body as string);
      requests.push({ body, authorization: (init.headers as any).Authorization });
      const existing = bookmarks.get(body.source_url);
      const bookmark = existing || { id: "saved-id", sourceUrl: body.source_url,
        userId: "reader", title: "Saved idea", createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), processingStatus: "processing" };
      bookmarks.set(body.source_url, bookmark);
      if (holdFirst) {
        holdFirst = false;
        return new Promise<Response>((resolve, reject) => {
          completeRequest = () => resolve(response({ bookmark, message: "Saved" }, 201));
          killRequest = () => reject(new Error("Process killed before acknowledgement"));
          init.signal?.addEventListener("abort", killRequest);
        });
      }
      return response({ bookmark, alreadySaved: !!existing, message: "Saved" }, existing ? 200 : 201);
    }
    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      return response({ ...bookmarks.values().next().value, ...body });
    }
    if (String(url).includes("/picks/today")) return response({ localDate: "2026-11-11", refreshesAt: "2026-11-12T11:00:00Z", items: [] });
    if (String(url).includes("/bookmarks/counts")) return response({ all: bookmarks.size, unread: bookmarks.size, archived: 0, inbox: bookmarks.size, collections: [] });
    if (String(url).includes("/feed")) return response({ items: [], topics: [], computedAt: new Date().toISOString() });
    if (String(url).includes("/explore")) return response({ items: [], topics: [], computedAt: new Date().toISOString() });
    if (String(url).includes("/continue-reading")) return response({ items: [], topics: [], computedAt: new Date().toISOString() });
    throw new Error(`Unexpected fixture request: ${init?.method} ${url}`);
  }) as any;
});

it("cold root Save writes durably, shows Home pending, and replays a lost acknowledgement exactly once", async () => {
  const app = render(<RootLayout />);
  // Flush asynchronous auth bootstrap and its cold screen imports before the field-query timer starts.
  await act(async () => {});
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/idea");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(requests).toHaveLength(1));
  const persisted = JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!);
  expect(persisted).toEqual([expect.objectContaining({ url: "https://example.com/idea", userId: "reader" })]);
  fireEvent.press(await app.findByRole("button", { name: "Done" }));
  expect(await app.findByText("https://example.com/idea")).toBeTruthy();
  expect(requests[0].authorization).toBe("Bearer fixture-jwt");
  app.unmount();
  await act(async () => killRequest());
  expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toHaveLength(1);
  const restarted = render(<RootLayout />);
  expect(await restarted.findByText("Saved idea")).toBeTruthy();
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toHaveLength(0));
  expect(requests).toHaveLength(2);
  expect(bookmarks.size).toBe(1);
  expect(requests[1].body.capture_source).toBe("save_sheet");
  expect(requests[1].body.capture_platform).toBe("ios");
});

it("keeps private description and optional note/timing separate on an offline save and replays confirmation", async () => {
  const transport = global.fetch;
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "POST") throw new Error("Offline");
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/private");
  fireEvent(app.getByLabelText("Page behind a login"), "valueChange", true);
  fireEvent.changeText(app.getByLabelText("Your title"), "Private title");
  fireEvent.changeText(app.getByLabelText("Describe this link"), "The description used to organise this link");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  fireEvent.changeText(await app.findByLabelText("Note (optional)"), "Why I saved this");
  fireEvent.press(app.getByRole("button", { name: "Tonight" }));
  fireEvent.press(app.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(mockPath).toBe("/(tabs)"));
  const [entry] = JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!);
  expect(entry).toMatchObject({ isPrivateLink: true, title: "Private title",
    description: "The description used to organise this link", note: "Why I saved this", laterUntil: expect.any(String) });
  expect(Date.parse(entry.laterUntil)).toBeGreaterThan(Date.now());
  app.unmount();
  global.fetch = transport;
  holdFirst = false;
  render(<RootLayout />);
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].body).toMatchObject({ is_private_link: true, title: "Private title",
    description: entry.description, user_note: entry.note, later_until: entry.laterUntil });
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toHaveLength(0));
});

it("after acceptance confirmation uses one generated owner PATCH and a failed change reverts", async () => {
  holdFirst = false;
  const transport = global.fetch;
  const patches: any[] = [];
  let fail = true;
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "PATCH") {
      patches.push(JSON.parse(init.body as string));
      if (fail) return response({ error: "Offline" }, 503);
      return response({ ...bookmarks.values().next().value, userNote: patches.at(-1).userNote, laterUntil: patches.at(-1).laterUntil });
    }
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/idea");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  await app.findByText("Saved. Cosmic is reading it.");
  fireEvent.changeText(app.getByLabelText("Note (optional)"), "Remember this");
  fireEvent.press(app.getByRole("button", { name: "This weekend" }));
  fireEvent.press(app.getByRole("button", { name: "Done" }));
  expect(await app.findByText("Change was not saved. Check your connection.")).toBeTruthy();
  expect(app.getByRole("alert")).toBeTruthy();
  expect(mockPath).toBe("/save");
  expect(patches).toEqual([{ userNote: "Remember this", laterUntil: expect.any(String) }]);
  expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toEqual([]);
  fail = false;
  fireEvent.press(app.getByRole("button", { name: "No rush" }));
  fireEvent.press(app.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(mockPath).toBe("/(tabs)"));
  expect(patches[1]).toEqual({ userNote: "Remember this", laterUntil: null });
});

it("confirmation written during a create is durable before acceptance and atomically applied after acceptance", async () => {
  const transport = global.fetch;
  const patches: any[] = [];
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "PATCH") {
      patches.push(JSON.parse(init.body as string));
      return response({ ...bookmarks.values().next().value, ...patches.at(-1) });
    }
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/idea");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(requests).toHaveLength(1));
  fireEvent.changeText(app.getByLabelText("Note (optional)"), "Written before acceptance");
  fireEvent.press(app.getByRole("button", { name: "Tonight" }));
  fireEvent.press(app.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(mockPath).toBe("/(tabs)"));
  expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)[0].note).toBe("Written before acceptance");
  expect(patches).toEqual([]);
  await act(async () => completeRequest());
  await waitFor(() => expect(patches).toEqual([{ userNote: "Written before acceptance", laterUntil: expect.any(String) }]));
  expect(bookmarks.size).toBe(1);
});

it("create ACK cannot discard confirmed note/timing while PATCH is held across provider unmount and restart", async () => {
  const transport = global.fetch;
  const patches: any[] = [];
  let holdPatch = true;
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      patches.push(body);
      if (holdPatch) return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("Killed before confirmation ACK")));
      });
      const bookmark = { ...bookmarks.values().next().value, ...body };
      bookmarks.set(bookmark.sourceUrl, bookmark);
      return response(bookmark);
    }
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/confirmation-kill");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.changeText(app.getByLabelText("Note (optional)"), "Durable edited note");
    fireEvent.press(app.getByRole("button", { name: "Tonight" }));
    fireEvent.press(app.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(mockPath).toBe("/(tabs)"));
    const [confirmed] = JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!);
    await act(async () => completeRequest());
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toEqual([
      expect.objectContaining({ id: confirmed.id, note: confirmed.note, laterUntil: confirmed.laterUntil, userId: "reader" }),
    ]);
    app.unmount();
    await act(async () => {});
    expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toHaveLength(1);
    holdPatch = false;
    const restarted = render(<RootLayout />);
    expect(await restarted.findByText("Saved idea")).toBeTruthy();
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toEqual([]));
    expect(bookmarks.size).toBe(1);
    expect(bookmarks.values().next().value).toMatchObject({ userNote: confirmed.note, laterUntil: confirmed.laterUntil });
    expect(patches).toEqual([patches[0], patches[0]]);
    // A stored create receipt replays the set-field reconciliation, not another create/job.
    expect(requests).toHaveLength(1);
    restarted.unmount();
  } finally { app.unmount(); }
});

it("edits and explicit clears made during a held confirmation PATCH remain durable until their own ACK", async () => {
  const transport = global.fetch;
  const patches: any[] = [];
  const acceptPatch: (() => void)[] = [];
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      patches.push(body);
      return new Promise<Response>((resolve, reject) => {
        acceptPatch.push(() => {
          const bookmark = { ...bookmarks.values().next().value, ...body };
          bookmarks.set(bookmark.sourceUrl, bookmark);
          resolve(response(bookmark));
        });
        init.signal?.addEventListener("abort", () => reject(new Error("Unmounted")));
      });
    }
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/newer-confirmation");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.changeText(app.getByLabelText("Note (optional)"), "First confirmed note");
    fireEvent.press(app.getByRole("button", { name: "Tonight" }));
    fireEvent.press(app.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(mockPath).toBe("/(tabs)"));
    const [entry] = await saveQueue.list();
    await act(async () => completeRequest());
    await waitFor(() => expect(patches).toHaveLength(1));
    await act(async () => mockCaptures.confirm(entry.id, "", null));
    expect(patches).toHaveLength(1);
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ note: "", laterUntil: null })]);
    await act(async () => acceptPatch[0]());
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1]).toEqual({ userNote: "", laterUntil: null });
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ note: "", laterUntil: null })]);
    await act(async () => acceptPatch[1]());
    await waitFor(async () => expect(await saveQueue.list()).toEqual([]));
    expect(bookmarks.values().next().value).toMatchObject({ userNote: "", laterUntil: null });
    expect(requests).toHaveLength(1);
  } finally { app.unmount(); }
});

it("account switch aborts reconciliation, hides the private capture and replays only for its owner despite a late PATCH response", async () => {
  const transport = global.fetch;
  const patches: { body: any; authorization: string }[] = [];
  let lateResponse!: () => void;
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      patches.push({ body, authorization: (init.headers as any).Authorization });
      if (patches.length === 1) return new Promise<Response>(resolve => {
        // Deliberately ignore abort, as a server can finish after session change.
        lateResponse = () => resolve(response({ ...bookmarks.values().next().value, ...body }));
      });
      const bookmark = { ...bookmarks.values().next().value, ...body };
      bookmarks.set(bookmark.sourceUrl, bookmark);
      return response(bookmark);
    }
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/private-account-intent");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.changeText(app.getByLabelText("Note (optional)"), "Owner private intent");
    fireEvent.press(app.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(mockPath).toBe("/(tabs)"));
    const [entry] = await saveQueue.list();
    await act(async () => completeRequest());
    await waitFor(() => expect(patches).toHaveLength(1));
    mockSession = { access_token: "other-jwt", user: { id: "other" } };
    await act(async () => mockAuthChange("SIGNED_IN", mockSession));
    await act(async () => lateResponse());
    await act(async () => mockCaptures.drain());
    expect(mockCaptures.captures).toEqual([]);
    await act(async () => { await expect(mockCaptures.confirm(entry.id, "Other account edit", null)).rejects.toThrow("account"); });
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ userId: "reader", note: "Owner private intent" })]);
    expect(patches).toHaveLength(1);
    mockSession = mockReaderSession;
    await act(async () => mockAuthChange("SIGNED_IN", mockSession));
    await waitFor(async () => expect(await saveQueue.list()).toEqual([]));
    expect(patches).toHaveLength(2);
    expect(patches.every(patch => patch.authorization === "Bearer fixture-jwt")).toBe(true);
    expect(bookmarks.values().next().value.userNote).toBe("Owner private intent");
    expect(requests).toHaveLength(1);
  } finally { lateResponse?.(); app.unmount(); }
});

it("a new account never receives the prior account's captures during the render before effect cleanup", async () => {
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/private-render");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    mockSession = { access_token: "other-jwt", user: { id: "other" } };
    await act(async () => mockAuthChange("SIGNED_IN", mockSession));
    expect(mockCaptureViews.filter(view => view.owner === "other")).not.toHaveLength(0);
    expect(mockCaptureViews.filter(view => view.owner === "other").flatMap(view => view.captureOwners)).not.toContain("reader");
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ userId: "reader", url: "https://example.com/private-render" })]);
  } finally { app.unmount(); }
});

it("replays on matching sign-in, foreground and Home pull to refresh after an offline launch", async () => {
  const { AppState, RefreshControl } = require("react-native");
  const foregroundListeners = new Set<(state: string) => void>();
  const foreground = (state: string) => { for (const callback of [...foregroundListeners]) callback(state); };
  const listener = jest.spyOn(AppState, "addEventListener").mockImplementation((event: unknown, callback: unknown) => {
    const notify = callback as (state: string) => void;
    if (event === "change") foregroundListeners.add(notify);
    return { remove: () => foregroundListeners.delete(notify) };
  });
  await AsyncStorage.setItem("save-queue:v1", JSON.stringify([{ id: "launch-entry", url: "https://example.com/launch", userId: "reader", captureSource: "save_sheet", capturePlatform: "ios", queuedAt: new Date().toISOString(), attempts: 0 }]));
  mockSession = null;
  mockPath = "/(tabs)";
  holdFirst = false;
  let creates = 0;
  const transport = global.fetch;
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "POST" && ++creates <= 2) throw new Error("Offline");
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  await app.findByText("Sign in");
  expect(creates).toBe(0);
  mockSession = mockReaderSession;
  await act(async () => mockAuthChange("SIGNED_IN", mockSession));
  await waitFor(() => expect(creates).toBe(1));
  await act(async () => foreground("active"));
  await waitFor(() => expect(creates).toBe(2));
  fireEvent(app.UNSAFE_getByType(RefreshControl), "refresh");
  await waitFor(() => expect(creates).toBe(3));
  expect(await app.findByText("Saved idea")).toBeTruthy();
  listener.mockRestore();
});

it("a replay 400 retains an unsent Home row with Remove and no Retry", async () => {
  const transport = global.fetch;
  global.fetch = jest.fn(async (url, init) => init?.method === "POST" ? response({ error: "Rejected" }, 400) : transport(url, init)) as any;
  const app = render(<RootLayout />);
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/rejected");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  fireEvent.press(await app.findByRole("button", { name: "Done" }));
  expect(await app.findByText("Couldn't save this link")).toBeTruthy();
  expect(app.queryByRole("button", { name: "Retry" })).toBeNull();
  // Remove crosses the storage promise lane; flush the event's React updates.
  await act(async () => { fireEvent.press(app.getByRole("button", { name: "Remove" })); });
  await waitFor(() => expect(app.queryByText("https://example.com/rejected")).toBeNull());
  expect(await AsyncStorage.getItem("save-queue:v1")).toBe("[]");
});

it("Remove stays removed when a Home refresh delivers its older durable queue snapshot afterward", async () => {
  const transport = global.fetch;
  global.fetch = jest.fn(async (url, init) => init?.method === "POST" ? response({ error: "Rejected" }, 400) : transport(url, init)) as any;
  const app = render(<RootLayout />);
  const list = saveQueue.list;
  let deliverSnapshot!: () => void;
  let captured = false;
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/rejected");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    fireEvent.press(await app.findByRole("button", { name: "Done" }));
    await app.findByText("Couldn't save this link");
    // Finish the original replay before holding a fresh real storage read.
    await act(async () => saveQueue.drain("reader", { create: async () => { throw new Error("Rejected rows must not replay"); } }));
    jest.spyOn(saveQueue, "list").mockImplementationOnce(async () => {
      const snapshot = await list();
      expect(snapshot[0].failure).toBe("rejected");
      return new Promise(resolve => { captured = true; deliverSnapshot = () => resolve(snapshot); });
    });
    fireEvent(app.UNSAFE_getByType(require("react-native").RefreshControl), "refresh");
    await waitFor(() => expect(captured).toBe(true));
    fireEvent.press(app.getByRole("button", { name: "Remove" }));
    await waitFor(async () => expect(await AsyncStorage.getItem("save-queue:v1")).toBe("[]"));
    await act(async () => deliverSnapshot());
    await act(async () => saveQueue.drain("reader", { create: async () => { throw new Error("Removed rows must not replay"); } }));
    expect(app.queryByText("https://example.com/rejected")).toBeNull();
    expect(app.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(await AsyncStorage.getItem("save-queue:v1")).toBe("[]");
  } finally {
    deliverSnapshot?.();
    jest.restoreAllMocks();
    app.unmount();
  }
});

it("Home keeps a processing capture above the loaded feed with real phases and its available filing path", async () => {
  holdFirst = false;
  const transport = global.fetch;
  global.fetch = jest.fn(async (url, init) => {
    if (String(url).includes("processing-timeline")) {
      const bookmark = { ...bookmarks.values().next().value, collectionPath: [{ id: "topic", name: "Reading" }] };
      const event = (phase: string, status: string, sequence: number) => ({ id: phase, runId: "run", kind: "phase", phase, name: phase, status, sequence, startedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, cachedInputTokens: 0 });
      return response({ bookmark, events: [event("fetch", "completed", 1), event("extract", "running", 2)], pollAfterMs: 2000 });
    }
    if (String(url).includes("/feed")) return response({ items: [...bookmarks.values()].map(bookmark => ({ type: "pending", bookmark })), computedAt: new Date().toISOString() });
    return transport(url, init);
  }) as any;
  const app = render(<RootLayout />);
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/idea");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  await app.findByText("Saved. Cosmic is reading it.");
  fireEvent.press(app.getByRole("button", { name: "Done" }));
  expect(await app.findByText("Fetched page")).toBeTruthy();
  expect(app.getByText("Extracting content…")).toBeTruthy();
  expect(app.getByText("Reading")).toBeTruthy();
});

it("iOS native Paste reads no clipboard contents or page title before an explicit tap and records clipboard attribution", async () => {
  mockHasUrl.mockResolvedValue(true);
  const app = render(<RootLayout />);
  expect(await app.findByText("Paste copied link")).toBeTruthy();
  expect(app.getByLabelText("Link").props.value).toBe("");
  expect(mockReadClipboard).not.toHaveBeenCalled();
  expect(requests).toEqual([]);
  fireEvent.press(app.getByRole("button", { name: "Paste" }));
  expect(app.getByLabelText("Link").props.value).toBe("https://example.com/copied");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].body.capture_source).toBe("clipboard");
  expect(mockReadClipboard).not.toHaveBeenCalled();
});

it("empty, invalid and incomplete private Saves keep the form usable without issuing a create", async () => {
  const app = render(<RootLayout />);
  await app.findByLabelText("Link");
  expect(app.queryByText("Paste copied link")).toBeNull();
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  expect(await app.findByText("Enter a complete http or https link.")).toBeTruthy();
  fireEvent.changeText(app.getByLabelText("Link"), "ftp://example.com/invalid");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  expect(requests).toHaveLength(0);
  fireEvent.changeText(app.getByLabelText("Link"), "https://example.com/private");
  fireEvent(app.getByLabelText("Page behind a login"), "valueChange", true);
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  expect(await app.findByText("Add a title and description for this private link.")).toBeTruthy();
  expect(app.getByLabelText("Describe this link").props.numberOfLines).toBeUndefined();
  expect(requests).toHaveLength(0);
});
it("the Save confirmation reports Already in your Library when the generated create is a duplicate", async () => {
  holdFirst = false;
  bookmarks.set("https://example.com/existing", { id: "existing-id", userId: "reader", sourceUrl: "https://example.com/existing", title: "Existing save", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), processingStatus: "completed" });
  const app = render(<RootLayout />);
  fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/existing");
  fireEvent.press(app.getByRole("button", { name: "Save" }));
  expect(await app.findByText("Already in your Library")).toBeTruthy();
  expect(bookmarks.size).toBe(1);
});

it.each(["pending", "accepted private"])("scopes the %s Save confirmation and private note to its account", async variant => {
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://private.example/account-a");
    if (variant === "accepted private") {
      fireEvent(app.getByLabelText("Page behind a login"), "valueChange", true);
      fireEvent.changeText(app.getByLabelText("Your title"), "A PRIVATE TITLE");
      fireEvent.changeText(app.getByLabelText("Describe this link"), "A PRIVATE DESCRIPTION");
    }
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.changeText(await app.findByLabelText("Note (optional)"), "A PRIVATE SAVE NOTE");
    if (variant === "accepted private") {
      expect(requests[0].body).toMatchObject({ is_private_link: true, title: "A PRIVATE TITLE", description: "A PRIVATE DESCRIPTION" });
      await act(async () => completeRequest());
      await waitFor(() => expect(mockCaptures.captures[0].status).toBe("saved"));
    }
    mockSession = { access_token: "other-jwt", user: { id: "other" } };
    await act(async () => mockAuthChange("SIGNED_IN", mockSession));
    expect(app.queryByText("https://private.example/account-a")).toBeNull();
    expect(app.queryByLabelText("Note (optional)")).toBeNull();
    expect(app.getByLabelText("Link").props.value).toBe("");
    expect(app.queryByLabelText("Your title")).toBeNull();
    expect(mockCaptures.captures).toEqual([]);
    if (variant === "pending") expect(await saveQueue.list()).toEqual([expect.objectContaining({ userId: "reader", url: "https://private.example/account-a" })]);
    expect(requests.every(request => request.authorization === "Bearer fixture-jwt")).toBe(true);
  } finally { app.unmount(); }
});

it("a completed confirmation from the prior account cannot navigate the new account's Save form", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = saveQueue.confirm;
  let confirmed = false;
  const spy = jest.spyOn(saveQueue, "confirm").mockImplementationOnce(async (...args) => {
    const value = await original(...args); confirmed = true; await gate; return value;
  });
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/a-stale-confirmation");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.changeText(await app.findByLabelText("Note (optional)"), "A DURABLE PRIVATE NOTE");
    fireEvent.press(app.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(confirmed).toBe(true));
    mockSession = { access_token: "other-jwt", user: { id: "other" } };
    await act(async () => mockAuthChange("SIGNED_IN", mockSession));
    fireEvent.changeText(app.getByLabelText("Link"), "https://example.com/b-draft");
    await act(async () => release());
    expect(mockPath).toBe("/save");
    expect(app.getByLabelText("Link").props.value).toBe("https://example.com/b-draft");
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ userId: "reader", note: "A DURABLE PRIVATE NOTE" })]);
  } finally { release(); app.unmount(); spy.mockRestore(); }
});

it("does not reuse an account-bound Paste route after an identity change or a new mount under another account", async () => {
  mockSaveParams = { url: "https://private.example/a-route", accountId: "reader" };
  let app = render(<RootLayout />);
  expect((await app.findByLabelText("Link")).props.value).toBe(mockSaveParams.url);
  mockSession = { access_token: "other-jwt", user: { id: "other" } };
  await act(async () => mockAuthChange("SIGNED_IN", mockSession));
  expect(app.getByLabelText("Link").props.value).toBe("");
  app.unmount();
  app = render(<RootLayout />);
  try { expect((await app.findByLabelText("Link")).props.value).toBe(""); }
  finally { app.unmount(); }
});
it("a late enqueue result cannot restore the prior account's Save confirmation", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = saveQueue.enqueue;
  let persisted = false;
  const spy = jest.spyOn(saveQueue, "enqueue").mockImplementationOnce(async (...args) => {
    const value = await original(...args); persisted = true; await gate; return value;
  });
  const app = render(<RootLayout />);
  try {
    fireEvent.changeText(await app.findByLabelText("Link"), "https://example.com/a-late-enqueue");
    fireEvent.press(app.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(persisted).toBe(true));
    mockSession = { access_token: "other-jwt", user: { id: "other" } };
    await act(async () => mockAuthChange("SIGNED_IN", mockSession));
    fireEvent.changeText(app.getByLabelText("Link"), "https://example.com/b-active-draft");
    await act(async () => release());
    expect(app.getByLabelText("Link").props.value).toBe("https://example.com/b-active-draft");
    expect(app.queryByLabelText("Note (optional)")).toBeNull();
    expect(mockPath).toBe("/save");
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ userId: "reader", url: "https://example.com/a-late-enqueue" })]);
    expect(requests).toEqual([]);
  } finally { release(); app.unmount(); spy.mockRestore(); }
});

it("ignores a legacy unscoped URL parameter instead of adopting another account's route draft", async () => {
  mockSaveParams = { url: "https://private.example/unscoped-old-route" };
  const app = render(<RootLayout />);
  try {
    expect((await app.findByLabelText("Link")).props.value).toBe("");
    expect(requests).toEqual([]);
  } finally { app.unmount(); }
});
