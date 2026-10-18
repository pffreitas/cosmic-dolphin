import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import HomeScreen from "../(tabs)/index";
import { useHomeFeed } from "@/hooks/useHomeFeed";
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
jest.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    appearance: "light",
    interests: [],
    hiddenTopics: [],
    update: jest.fn(),
  }),
}));
jest.mock("@/hooks/useHomeFeed", () => ({ useHomeFeed: jest.fn() }));
jest.mock("@/lib/api", () => ({ BookmarksAPI: {} }));
jest.mock("@/lib/mobile-api", () => ({
  nativeBookmark: (value: unknown) => value,
}));
const bookmark = (id: string, topic: string) => ({
  id,
  title: `${topic} article`,
  sourceUrl: "https://example.com/" + id,
  userId: "reader",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  cosmicTags: [topic],
});
it("clears a For you topic filter when switching into a different Following feed", async () => {
  (useHomeFeed as jest.Mock).mockImplementation((scope) => ({
    loading: false,
    refreshing: false,
    resume: [],
    refresh: jest.fn(),
    loadMore: jest.fn(),
    more: false,
    hasMore: false,
    items: (scope === "following"
      ? [bookmark("design", "Design")]
      : [bookmark("ai", "AI"), bookmark("design", "Design")]
    ).map((bookmark) => ({ type: "own_save", bookmark })),
  }));
  const view = render(<HomeScreen />);
  fireEvent.press(view.getByText("AI"));
  expect(view.queryByText("Design article")).toBeNull();
  fireEvent.press(view.getByText("Following"));
  await waitFor(() => expect(view.getByText("Design article")).toBeTruthy());
  expect(view.queryByText("Good reading travels through people")).toBeNull();
});
