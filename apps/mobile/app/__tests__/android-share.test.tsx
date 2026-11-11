/* eslint-disable @typescript-eslint/no-require-imports -- Native Jest factories precede imports. */
import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, ActivityIndicator, BackHandler, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RootLayout from "../_layout";
import { saveQueue } from "@/lib/save-queue";

let mockAndroidBridge: any = null;
jest.mock("../../modules/share-queue", () => ({ pendingShares: () => null, androidShares: () => mockAndroidBridge }));
const mockReader = { access_token: "fictional-test-jwt", user: { id: "reader" } };
let mockSession: any = null;
let mockAuthChange: (event: string, session: any) => void;
let mockAuthPending = true;
let mockResolveAuth: (value: any) => void;
let mockPath = "/(tabs)";
let mockParams: any = {};
let mockDeferredRoutes: any[] | null = null;
let mockCommitRoute: (route: any) => void;
let mockIntent: any;
let mockHasIntent = true;
let mockRefresh: () => void;
const mockReset = jest.fn(() => { mockHasIntent = false; mockRefresh?.(); });
jest.mock("@/lib/supabase", () => ({ supabase: { auth: {
  getSession: () => mockAuthPending ? new Promise(resolve => { mockResolveAuth = resolve; }) : Promise.resolve({ data: { session: mockSession } }),
  onAuthStateChange: (callback: any) => { mockAuthChange = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
} } }));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("crypto").randomUUID() }));
jest.mock("react-native-reanimated", () => ({}));
jest.mock("expo-font", () => ({ useFonts: () => [true], isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ addEventListener: () => ({ remove: jest.fn() }), getInitialURL: async () => null }));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "cosmicdolphin:///" }));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-share-intent", () => ({ ShareIntentProvider: ({ children }: any) => children,
  useShareIntentContext: () => ({ hasShareIntent: mockHasIntent, shareIntent: mockIntent, resetShareIntent: mockReset }) }));
jest.mock("expo-router", () => {
  const React = require("react");
  const listeners = new Set<() => void>();
  mockCommitRoute = (route: any) => {
    const path = typeof route === "string" ? route : route.pathname;
    mockPath = path.split("?")[0];
    mockParams = typeof route === "string" ? Object.fromEntries(new URLSearchParams(path.split("?")[1])) : route.params;
    listeners.forEach(fn => fn());
  };
  const router = { replace: (route: any) => {
    if (mockDeferredRoutes) mockDeferredRoutes.push(route);
    else mockCommitRoute(route);
  }, back: jest.fn() };
  function useRoute() {
    const [, refresh] = React.useReducer((n: number) => n + 1, 0);
    mockRefresh = () => listeners.forEach(fn => fn());
    React.useEffect(() => { listeners.add(refresh); return () => listeners.delete(refresh); }, []);
  }
  function Stack() {
    useRoute();
    if (mockPath === "/share") return React.createElement(require("../share").default);
    return React.createElement(require("react-native").Text, {}, mockPath.startsWith("/(auth)") ? "Sign in" : "Home");
  }
  Stack.Screen = function StackScreen() { return null; };
  return { Stack, useRouter: () => router, usePathname: () => { useRoute(); return mockPath; },
    useSegments: () => [mockPath.startsWith("/(auth)") ? "(auth)" : mockPath === "/share" ? "share" : "(tabs)"],
    useLocalSearchParams: () => mockParams };
});
let requests: any[];
beforeEach(async () => {
  jest.clearAllMocks(); mockAndroidBridge = null; mockDeferredRoutes = null;
  Platform.OS = "android";
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  jest.spyOn(BackHandler, "exitApp").mockImplementation(() => {});
  await AsyncStorage.clear();
  mockAuthPending = true; mockSession = null; mockPath = "/(tabs)"; mockParams = {}; mockHasIntent = true;
  mockIntent = { type: "text", text: "Read https://example.com/android", webUrl: "https://example.com/android" };
  requests = [];
  global.fetch = jest.fn(async (url, init) => {
    if (init?.method === "POST" && String(url).endsWith("/bookmarks")) {
      const body = JSON.parse(init.body as string);
      requests.push({ body, durable: await saveQueue.list() });
      return new Response(JSON.stringify({ bookmark: { id: "saved", sourceUrl: body.source_url, userId: "reader", title: "Shared article", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), processingStatus: "processing" }, message: "Saved" }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected fixture request ${String(url)}`);
  }) as any;
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
async function finishAuth(session: any) {
  mockAuthPending = false; mockSession = session;
  await act(async () => { mockResolveAuth({ data: { session } }); });
}
it("persists the root arrival before auth resolves, then signs in and saves without a tap", async () => {
  const app = render(<RootLayout />);
  await waitFor(async () => expect(await saveQueue.list()).toEqual([expect.objectContaining({ url: "https://example.com/android", captureSource: "android_share", capturePlatform: "android", attempts: 0 })]));
  expect(requests).toHaveLength(0);
  await finishAuth(null);
  expect(await app.findByText("Sign in")).toBeTruthy();
  await act(async () => { mockSession = mockReader; mockAuthChange("SIGNED_IN", mockReader); });
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  expect(app.queryByRole("button", { name: "Save" })).toBeNull();
  expect(requests).toHaveLength(1);
  expect(requests[0].durable).toHaveLength(1);
  expect(requests[0].body).toMatchObject({ capture_source: "android_share", capture_platform: "android" });
  app.unmount();
});
it("shows a signed-in result for 1.5 seconds then returns to the sender", async () => {
  const app = render(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  expect(BackHandler.exitApp).not.toHaveBeenCalled();
  await waitFor(() => expect(BackHandler.exitApp).toHaveBeenCalledTimes(1), { timeout: 2200 });
  app.unmount();
});
it("acknowledges a persisted offline save then returns, retaining it across restart", async () => {
  global.fetch = jest.fn(async () => { throw new TypeError("Network request failed"); }) as any;
  const app = render(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Saved on this phone. Cosmic reads it when you open the app.")).toBeTruthy();
  const [entry] = await saveQueue.list();
  expect(entry).toMatchObject({ url: "https://example.com/android", userId: "reader" });
  await waitFor(() => expect(BackHandler.exitApp).toHaveBeenCalledTimes(1), { timeout: 2200 });
  app.unmount();
  mockAuthPending = true;
  const restarted = render(<RootLayout />);
  await finishAuth(null);
  expect(await restarted.findByText("Sign in")).toBeTruthy();
  expect(await saveQueue.list()).toEqual([entry]);
  restarted.unmount();
});
it("retains the TalkBack result with an accessible Close instead of automatic return", async () => {
  (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);
  const app = render(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  const close = app.getByRole("button", { name: "Close" });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1600)); });
  expect(BackHandler.exitApp).not.toHaveBeenCalled();
  require("@testing-library/react-native").fireEvent.press(close);
  expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  app.unmount();
});
it("shows the specified no-link copy without enqueue or any request", async () => {
  mockIntent = { type: "text", text: "There is no link to save" };
  const app = render(<RootLayout />);
  await finishAuth(null);
  expect(await app.findByText("Cosmic Dolphin can only save links")).toBeTruthy();
  expect(await saveQueue.list()).toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(BackHandler.exitApp).not.toHaveBeenCalled();
  app.unmount();
});
it("does not duplicate an arrival on effect reruns but saves a subsequent same-URL intent", async () => {
  const app = render(<RootLayout />);
  await waitFor(async () => expect(await saveQueue.list()).toHaveLength(1));
  app.rerender(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  expect(requests).toHaveLength(1);
  await act(async () => { mockHasIntent = true; mockIntent = { ...mockIntent }; mockRefresh(); });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].durable[0].id).not.toBe(requests[1].durable[0].id);
  expect(requests[1].body.source_url).toBe(requests[0].body.source_url);
  app.unmount();
});
it("keeps a rejected capture visible with Remove and no misleading success or return", async () => {
  global.fetch = jest.fn(async () => new Response(null, { status: 400 })) as any;
  const app = render(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Couldn't save this link")).toBeTruthy();
  expect(app.queryByRole("button", { name: "Retry" })).toBeNull();
  require("@testing-library/react-native").fireEvent.press(app.getByRole("button", { name: "Remove" }));
  await waitFor(async () => expect(await saveQueue.list()).toEqual([]));
  expect(BackHandler.exitApp).not.toHaveBeenCalled();
  app.unmount();
});
it("lets TalkBack retry a retained network failure and accepts an already-saved result", async () => {
  (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);
  const success = global.fetch;
  let offline = true;
  global.fetch = jest.fn(async (url, init) => {
    if (offline && init?.method === "POST" && String(url).endsWith("/bookmarks")) { offline = false; throw new TypeError("Offline"); }
    return success(url, init);
  }) as any;
  const app = render(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Saved on this phone. Cosmic reads it when you open the app.")).toBeTruthy();
  require("@testing-library/react-native").fireEvent.press(app.getByRole("button", { name: "Retry" }));
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  expect(await saveQueue.list()).toEqual([]);
  app.unmount();
});

it("captures a native text/html delivery before auth and acknowledges only after durable enqueue", async () => {
  mockHasIntent = false;
  const delivery = { id: "native-html-delivery", text: "First https://example.com/html second https://later.com", queuedAt: "2026-11-10T12:00:00Z", offline: false };
  let pending = true;
  mockAndroidBridge = {
    readAndroidShares: async () => JSON.stringify(pending ? [delivery] : []),
    addListener: () => ({ remove: jest.fn() }),
    removeAndroidShares: jest.fn(async () => { expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: delivery.id, url: "https://example.com/html", queuedAt: delivery.queuedAt })]); pending = false; }),
  };
  const app = render(<RootLayout />);
  await waitFor(() => expect(mockAndroidBridge.removeAndroidShares).toHaveBeenCalledWith([delivery.id]));
  await finishAuth(mockReader);
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  expect(requests[0].body).toMatchObject({ source_url: "https://example.com/html", queued_at: new Date(delivery.queuedAt).toISOString() });
  app.unmount();
});
it("acknowledges a native offline signed-out arrival only after persistence and returns without signing in", async () => {
  mockHasIntent = false;
  const delivery = { id: "offline-signed-out", text: "https://example.com/offline-signed-out", queuedAt: "2026-11-10T12:00:00Z", offline: true };
  let pending = true;
  mockAndroidBridge = { readAndroidShares: async () => JSON.stringify(pending ? [delivery] : []), addListener: () => ({ remove: jest.fn() }),
    removeAndroidShares: async () => { expect(await saveQueue.list()).toHaveLength(1); pending = false; } };
  const app = render(<RootLayout />);
  await finishAuth(null);
  expect(await app.findByText("Saved on this phone. Cosmic reads it when you open the app.")).toBeTruthy();
  expect(global.fetch).not.toHaveBeenCalled();
  await waitFor(() => expect(BackHandler.exitApp).toHaveBeenCalledTimes(1), { timeout: 2200 });
  expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: delivery.id, attempts: 0 })]);
  app.unmount();
});
it("routes a genuine later online share to sign-in after an offline result was closed", async () => {
  mockHasIntent = false;
  let notify!: () => void;
  let pending: any[] = [{ id: "offline-first", text: "https://example.com/same", queuedAt: new Date().toISOString(), offline: true }];
  mockAndroidBridge = { readAndroidShares: async () => JSON.stringify(pending),
    addListener: (_event: string, callback: () => void) => { notify = callback; return { remove: jest.fn() }; },
    removeAndroidShares: async (ids: string[]) => { pending = pending.filter(entry => !ids.includes(entry.id)); } };
  const app = render(<RootLayout />);
  await finishAuth(null);
  expect(await app.findByText("Saved on this phone. Cosmic reads it when you open the app.")).toBeTruthy();
  require("@testing-library/react-native").fireEvent.press(app.getByRole("button", { name: "Close" }));
  await act(async () => {
    pending = [{ id: "online-second", text: "https://example.com/same", queuedAt: new Date().toISOString(), offline: false }];
    notify();
  });
  expect(await app.findByText("Sign in")).toBeTruthy();
  expect(await saveQueue.list()).toHaveLength(2);
  app.unmount();
});
it("returns only once when Close is tapped before the result timer expires", async () => {
  const app = render(<RootLayout />);
  await finishAuth(mockReader);
  expect(await app.findByText("Saved to Cosmic Dolphin")).toBeTruthy();
  require("@testing-library/react-native").fireEvent.press(app.getByRole("button", { name: "Close" }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1600)); });
  expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  app.unmount();
});
it("does not replace a pending offline result navigation with sign-in before Expo commits the route", async () => {
  mockHasIntent = false;
  mockDeferredRoutes = [];
  let pending = true;
  const delivery = { id: "cold-offline", text: "https://example.com/cold", queuedAt: new Date().toISOString(), offline: true };
  mockAndroidBridge = { readAndroidShares: async () => JSON.stringify(pending ? [delivery] : []),
    addListener: () => ({ remove: jest.fn() }), removeAndroidShares: async () => { pending = false; } };
  const app = render(<RootLayout />);
  await finishAuth(null);
  await waitFor(() => expect(mockDeferredRoutes?.at(-1)).toEqual(expect.objectContaining({ pathname: "/share" })));
  const route = mockDeferredRoutes!.at(-1);
  await act(async () => { mockDeferredRoutes = null; mockCommitRoute(route); });
  expect(await app.findByText("Saved on this phone. Cosmic reads it when you open the app.")).toBeTruthy();
  expect(await saveQueue.list()).toHaveLength(1);
  app.unmount();
});

it("keeps cold-start auth loading still when reduced motion is enabled", async () => {
  mockHasIntent = false;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  const app = render(<RootLayout />);
  await waitFor(() => expect(app.UNSAFE_getByType(ActivityIndicator).props.animating).toBe(false));
  app.unmount();
});
