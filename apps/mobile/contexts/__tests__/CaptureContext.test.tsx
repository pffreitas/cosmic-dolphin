import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAuth } from "../AuthContext";
import { CaptureProvider, useCaptures } from "../CaptureContext";
import { MobileAPI } from "@/lib/mobile-api";
import AsyncStorage from "@react-native-async-storage/async-storage";
jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/mobile-api", () => ({ MobileAPI: { create: jest.fn() } }));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("crypto").randomUUID() }));
jest.mock("@/lib/bookmark-cache", () => ({
  cacheBookmarksInBackground: jest.fn(),
}));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CaptureProvider>{children}</CaptureProvider>
);
describe("nonblocking capture", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "reader" } });
  });
  it("creates an immediate usable row while the save is still in flight", async () => {
    let finish!: (value: unknown) => void;
    (MobileAPI.create as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useCaptures(), { wrapper });
    await act(async () => { await result.current.save({ sourceUrl: "https://example.com/idea", captureSource: "save_sheet", capturePlatform: "ios" }); });
    expect(result.current.captures[0].status).toBe("saving");
    expect(result.current.captures[0].entry.url).toBe(
      "https://example.com/idea",
    );
    await act(async () =>
      finish({ bookmark: { id: "saved-id", userId: "reader", title: "Saved idea" } }),
    );
    expect(result.current.captures[0].bookmark?.id).toBe("saved-id");
    expect(result.current.revision).toBe(1);
  });
  it("retains private-link fields after failure and retries the same capture", async () => {
    (MobileAPI.create as jest.Mock)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ bookmark: { id: "saved-id", userId: "reader" } });
    const { result } = renderHook(() => useCaptures(), { wrapper });
    const params = {
      sourceUrl: "https://example.com/private",
      isPrivateLink: true,
      title: "Private title",
      description: "Private note",
      captureSource: "save_sheet" as const, capturePlatform: "ios" as const,
    };
    await act(async () => { await result.current.save(params); });
    await waitFor(() =>
      expect(result.current.captures[0].status).toBe("failed"),
    );
    act(() => result.current.retry(result.current.captures[0].id));
    await waitFor(() =>
      expect(result.current.captures[0].status).toBe("saved"),
    );
    expect(MobileAPI.create).toHaveBeenNthCalledWith(2, expect.objectContaining(params), expect.anything(), "reader");
    expect(result.current.captures).toHaveLength(1);
  });
});
