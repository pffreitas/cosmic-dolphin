import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../AuthContext";
import { PreferencesProvider, usePreferences } from "../PreferencesContext";
jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);
describe("device reading preferences", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "reader-a" } });
  });
  it("restores settings for the signed-in reader and persists interest changes", async () => {
    await AsyncStorage.setItem(
      "cosmic:preferences:reader-a",
      JSON.stringify({ appearance: "dark", interests: ["AI"] }),
    );
    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appearance).toBe("dark");
    act(() => result.current.update({ interests: ["Design"] }));
    await waitFor(async () =>
      expect(
        JSON.parse((await AsyncStorage.getItem("cosmic:preferences:reader-a"))!)
          .interests,
      ).toEqual(["Design"]),
    );
  });
  it("clears one reader’s settings when the account changes", async () => {
    const { result, rerender } = renderHook(() => usePreferences(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() =>
      result.current.update({ interests: ["AI"], hiddenTopics: ["Design"] }),
    );
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "reader-b" } });
    rerender({});
    await waitFor(() => expect(result.current.interests).toEqual([]));
    expect(result.current.hiddenTopics).toEqual([]);
  });
});
