import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import TopicScreen from "../topic";
import { MobileAPI } from "@/lib/mobile-api";
jest.mock("@/lib/api", () => ({ BookmarksAPI: {} }));
let mockId = "digest:first";
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
jest.mock("@/lib/mobile-api", () => ({ MobileAPI: { digest: jest.fn() } }));
it("replaces previous topic content with an error when a new collection cannot load", async () => {
  (MobileAPI.digest as jest.Mock)
    .mockResolvedValueOnce({
      id: "first",
      title: "First reading list",
      summary: "A sourced connection",
      keyPoints: [],
      sources: [],
    })
    .mockRejectedValueOnce(new Error("Network error"));
  const view = render(<TopicScreen />);
  await waitFor(() =>
    expect(view.getByText("First reading list")).toBeTruthy(),
  );
  mockId = "digest:second";
  view.rerender(<TopicScreen />);
  await waitFor(() =>
    expect(
      view.getByText("This reading list could not be loaded"),
    ).toBeTruthy(),
  );
  expect(view.queryByText("First reading list")).toBeNull();
});
