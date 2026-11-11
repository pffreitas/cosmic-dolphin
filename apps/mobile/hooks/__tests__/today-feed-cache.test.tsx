import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHomeFeed } from "../useHomeFeed";
import { MobileAPI } from "@/lib/mobile-api";

let mockUserId = "reader-a";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ revision: 0 }) }));
jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- The navigation boundary is hoisted before imports.
  const React = require("react");
  return { useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock("@/lib/mobile-api", () => ({ MobileAPI: { feed: jest.fn(), picks: jest.fn(), resume: jest.fn(), counts: jest.fn() } }));

it("discards an old account's delayed disk read when the new account loads offline", async () => {
  await AsyncStorage.clear();
  let resolveOld!: (value: string) => void;
  let rejectFeed!: (reason: Error) => void;
  let rejectPicks!: (reason: Error) => void;
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => key === "home-feed:v1:reader-a:for_you"
    ? new Promise<string>(resolve => { resolveOld = resolve; }) : Promise.resolve(null));
  (MobileAPI.feed as jest.Mock).mockImplementation(() => new Promise((_, reject) => { rejectFeed = reject; }));
  (MobileAPI.picks as jest.Mock).mockImplementation(() => new Promise((_, reject) => { rejectPicks = reject; }));
  (MobileAPI.resume as jest.Mock).mockResolvedValue({ items: [] });
  (MobileAPI.counts as jest.Mock).mockResolvedValue({ all: 0, archived: 0 });
  const view = renderHook<ReturnType<typeof useHomeFeed>, { userId: string }>(({ userId }) => {
    mockUserId = userId;
    return useHomeFeed("for_you");
  }, { initialProps: { userId: "reader-a" } });
  await waitFor(() => expect(resolveOld).toBeDefined());
  view.rerender({ userId: "reader-b" });
  await waitFor(() => expect(rejectFeed).toBeDefined());
  await act(async () => {
    resolveOld(JSON.stringify({ userId: "reader-a", scope: "for_you", resume: [], items: [{
      type: "own_save", bookmark: { id: "private-a", userId: "reader-a", title: "Reader A private save",
        sourceUrl: "https://private.example/a", createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z" },
    }] }));
  });
  await act(async () => {
    rejectFeed(new Error("offline"));
    rejectPicks(new Error("offline"));
  });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.items).toEqual([]);
  expect(view.result.current.picks).toBeUndefined();
  expect(view.result.current.offline).toBe(false);
  view.unmount();
});
