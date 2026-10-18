import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAuth } from "../AuthContext";
import { CaptureProvider, useCaptures } from "../CaptureContext";
import { BookmarksAPI } from "@/lib/api";
jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/api", () => ({ BookmarksAPI: { create: jest.fn() } }));
jest.mock("@/lib/bookmark-cache", () => ({
  cacheBookmarksInBackground: jest.fn(),
}));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CaptureProvider>{children}</CaptureProvider>
);
describe("nonblocking capture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "reader" } });
  });
  it("creates an immediate usable row while the save is still in flight", async () => {
    let finish!: (value: unknown) => void;
    (BookmarksAPI.create as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useCaptures(), { wrapper });
    act(() => result.current.save({ source_url: "https://example.com/idea" }));
    expect(result.current.captures[0].status).toBe("saving");
    expect(result.current.captures[0].params.source_url).toBe(
      "https://example.com/idea",
    );
    await act(async () =>
      finish({ bookmark: { id: "saved-id", title: "Saved idea" } }),
    );
    expect(result.current.captures[0].bookmark?.id).toBe("saved-id");
    expect(result.current.revision).toBe(1);
  });
  it("retains private-link fields after failure and retries the same capture", async () => {
    (BookmarksAPI.create as jest.Mock)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ bookmark: { id: "saved-id" } });
    const { result } = renderHook(() => useCaptures(), { wrapper });
    const params = {
      source_url: "https://example.com/private",
      is_private_link: true,
      title: "Private title",
      description: "Private note",
    };
    act(() => result.current.save(params));
    await waitFor(() =>
      expect(result.current.captures[0].status).toBe("failed"),
    );
    act(() => result.current.retry(result.current.captures[0].id));
    await waitFor(() =>
      expect(result.current.captures[0].status).toBe("saved"),
    );
    expect(BookmarksAPI.create).toHaveBeenNthCalledWith(2, params);
    expect(result.current.captures).toHaveLength(1);
  });
});
