import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { Collection } from "@cosmic-dolphin/api-client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeSidebar } from "../web-home/Sidebar";
import { MobileAPI } from "@/lib/mobile-api";
import { sidebarCollections } from "../web-home/sidebar-data";

let mockUser = {
  id: "a",
  email: "a@example.invalid",
  user_metadata: { full_name: "Alice Reader" },
};
const mockUpdate = jest.fn();
const mockSignOut = jest.fn(async () => {});
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    signOutBusy: false,
    signOutError: "",
  }),
}));
jest.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({ appearance: "system", update: mockUpdate }),
}));
jest.mock("@/lib/mobile-api", () => ({
  MobileAPI: { collections: jest.fn() },
}));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      insets: { top: 62, bottom: 34, left: 0, right: 0 },
      frame: { x: 0, y: 0, width: 402, height: 874 },
    }}
  >
    {children}
  </SafeAreaProvider>
);
const props = {
  counts: null,
  onClose: jest.fn(),
  onDestination: jest.fn(),
  onLibrary: jest.fn(),
};
const collection = (
  id: string,
  name: string,
  parentId?: string,
): Collection => ({ id, name, parentId, userId: "a" });
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {
    id: "a",
    email: "a@example.invalid",
    user_metadata: { full_name: "Alice Reader" },
  };
  (MobileAPI.collections as jest.Mock).mockResolvedValue([]);
});

it("hides A's open account popup and fences A's held collections when B arrives", async () => {
  let finishA!: (collections: Collection[]) => void;
  (MobileAPI.collections as jest.Mock).mockImplementation((owner) =>
    owner === "a"
      ? new Promise((resolve) => {
          finishA = resolve;
        })
      : Promise.resolve([
          { ...collection("b", "Bob's collection"), userId: "b" },
        ]),
  );
  const ui = render(<HomeSidebar {...props} />, { wrapper });
  fireEvent.press(
    ui.getByRole("button", { name: "Alice Reader Account menu" }),
  );
  expect(ui.getByRole("button", { name: "Your profile" })).toBeTruthy();
  mockUser = {
    id: "b",
    email: "b@example.invalid",
    user_metadata: { full_name: "Bob Reader" },
  };
  ui.rerender(<HomeSidebar {...props} />);
  expect(ui.queryByText("Alice Reader")).toBeNull();
  expect(ui.queryByText("a@example.invalid")).toBeNull();
  expect(ui.queryByRole("button", { name: "Your profile" })).toBeNull();
  await waitFor(() =>
    expect(ui.getByRole("button", { name: "Bob's collection" })).toBeTruthy(),
  );
  await act(async () =>
    finishA([collection("private-a", "Alice's private collection")]),
  );
  expect(ui.queryByText("Alice's private collection")).toBeNull();
  expect(MobileAPI.collections).toHaveBeenLastCalledWith("b");
});

it("uses the existing preferences and sign-out boundaries from the account menu", async () => {
  const ui = render(<HomeSidebar {...props} />, { wrapper });
  await waitFor(() =>
    expect(ui.queryByText("Loading collections…")).toBeNull(),
  );
  fireEvent.press(
    ui.getByRole("button", { name: "Alice Reader Account menu" }),
  );
  expect(
    ui.getByRole("radio", { name: "Match system" }).props.accessibilityState
      .checked,
  ).toBe(true);
  fireEvent.press(ui.getByRole("radio", { name: "Dark" }));
  expect(mockUpdate).toHaveBeenCalledWith({ appearance: "dark" });
  expect(ui.queryByRole("radio", { name: "Dark" })).toBeNull();
  fireEvent.press(
    ui.getByRole("button", { name: "Alice Reader Account menu" }),
  );
  fireEvent.press(ui.getByRole("button", { name: "Sign out" }));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it("keeps two-level totals, alphabetic order and orphan/third-level collections reachable", () => {
  const tree = sidebarCollections(
    [
      collection("root", "Design"),
      collection("child", "Typography", "root"),
      collection("third", "Third level", "child"),
      collection("orphan", "Orphan", "missing"),
    ],
    {
      all: 10,
      inbox: 0,
      unread: 1,
      archived: 0,
      collections: [
        { collectionId: "root", count: 2 },
        { collectionId: "child", count: 5 },
      ],
    },
  );
  expect(tree.map((node) => node.name)).toEqual([
    "Design",
    "Orphan",
    "Third level",
  ]);
  expect(tree[0].count).toBe(7);
  expect(tree[0].children[0].name).toBe("Typography");
});

it("retries a failed collection load without inventing an empty collection state", async () => {
  (MobileAPI.collections as jest.Mock)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([collection("design", "Design")]);
  const ui = render(<HomeSidebar {...props} />, { wrapper });
  fireEvent.press(await ui.findByRole("button", { name: "Retry collections" }));
  expect(await ui.findByRole("button", { name: "Design" })).toBeTruthy();
  expect(ui.queryByText("Collections couldn’t load.")).toBeNull();
});
