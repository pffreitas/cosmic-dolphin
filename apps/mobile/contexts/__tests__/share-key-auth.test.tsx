import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import ProfileScreen from "@/app/profile";
import { PreferencesProvider } from "../PreferencesContext";
import { AppState } from "react-native";
import { AuthProvider, useAuth } from "../AuthContext";
import { ShareKeyManager, type SharedShareKey } from "@/lib/share-key";
import { supabase } from "@/lib/supabase";
jest.mock("expo-router", () => ({ useRouter: () => ({ push() {} }), useFocusEffect: (callback: () => void) => require("react").useEffect(callback, [callback]) }));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() } } }));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "cosmicdolphin://auth/callback" }));
jest.mock("expo-auth-session/build/QueryParams", () => ({ getQueryParams: () => ({ params: {} }) }));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-linking", () => ({ addEventListener: () => ({ remove() {} }), getInitialURL: async () => null }));
jest.mock("@/lib/bookmark-cache", () => ({ clearBookmarkCache: jest.fn() }));
const session = { access_token: "JWT_NOT_FOR_EXTENSION", user: { id: "reader" } };
let item: SharedShareKey | null;
let auth: ReturnType<typeof useAuth>;
let stateChange: (event: string, session: any) => void;
let foreground: (state: any) => void;
const api = { issue: jest.fn(async () => ({ id: "issued", key: `cdsk_${"a".repeat(43)}` })), revoke: jest.fn(async () => {}) };
function Harness() { auth = useAuth(); return null; }
function mount(children?: React.ReactNode) {
  const manager = new ShareKeyManager({ api, apiBaseUrl: "https://fixture.example", storage: {
    read: async () => item, write: async value => { item = value; }, remove: async () => { item = null; }, deviceId: async () => "device",
  } });
  return render(<AuthProvider shareKeys={manager}><Harness /><PreferencesProvider>{children}</PreferencesProvider></AuthProvider>);
}
beforeEach(() => {
  jest.clearAllMocks(); item = null;
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ id: "reader", name: "Reader" }), { status: 200 })) as any;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => { foreground = callback; return { remove() {} }; });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session }, error: null });
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(callback => { stateChange = callback; return { data: { subscription: { unsubscribe() {} } } }; });
  (supabase.auth.signOut as jest.Mock).mockImplementation(async () => { stateChange("SIGNED_OUT", null); return { error: null }; });
});
afterEach(() => jest.restoreAllMocks());
it("wires signed-in initialization to the restricted key instead of storing the JWT", async () => {
  mount();
  await waitFor(() => expect(item?.keyId).toBe("issued"));
  expect(auth.user?.id).toBe("reader");
  expect(JSON.stringify(item)).not.toContain(session.access_token);
});
it("reissues a missing foreground key but preserves an existing one", async () => {
  mount(); await waitFor(() => expect(item).not.toBeNull());
  await act(async () => { foreground("active"); });
  expect(api.issue).toHaveBeenCalledTimes(1);
  item = null;
  await act(async () => { foreground("active"); });
  await waitFor(() => expect(item?.keyId).toBe("issued"));
  expect(api.issue).toHaveBeenCalledTimes(2);
});
it("keeps the signed-in session and key on offline revoke and Retry finishes only after acknowledgement", async () => {
  mount(); await waitFor(() => expect(item).not.toBeNull());
  api.revoke.mockRejectedValueOnce(new Error("offline"));
  await act(async () => { await auth.signOut(); });
  expect(auth.user?.id).toBe("reader");
  expect(item?.keyId).toBe("issued");
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  await act(async () => { await auth.signOut(); });
  expect(api.revoke).toHaveBeenCalledTimes(2);
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  expect(item).toBeNull();
  expect(auth.user).toBeNull();
});
it("shows S-15 busy and exact offline Retry copy in Profile, then signs out", async () => {
  const view = mount(<ProfileScreen />);
  await waitFor(() => expect(item).not.toBeNull());
  let fail!: () => void;
  api.revoke.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = () => reject(new Error("offline")); }));
  fireEvent.press(view.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(view.getByRole("button", { name: "Finishing sign out…" }).props.accessibilityState).toMatchObject({ busy: true, disabled: true }));
  await act(async () => { fail(); });
  expect(view.getByText("Connect to finish signing out")).toBeTruthy();
  expect(auth.user?.id).toBe("reader");
  fireEvent.press(view.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(auth.user).toBeNull());
  expect(view.getByText("You’re signed out.")).toBeTruthy();
});
it("does not restore a stale initial session or issue another key after sign-out", async () => {
  let initial!: (value: any) => void;
  (supabase.auth.getSession as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { initial = resolve; }));
  mount();
  await act(async () => { stateChange("SIGNED_IN", session); });
  await waitFor(() => expect(item).not.toBeNull());
  await act(async () => { await auth.signOut(); });
  await act(async () => { initial({ data: { session }, error: null }); });
  expect(auth.user).toBeNull();
  expect(item).toBeNull();
  expect(api.issue).toHaveBeenCalledTimes(1);
});
