import React from "react";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { Stack } from "expo-router";
import CollectionsScreen from "../collections";
import ProfileScreen from "../profile";
import { MobileAPI } from "@/lib/mobile-api";
import LibraryScreen from "../(tabs)/library";
import { useBookmarks } from "@/hooks/useBookmarks";
import SaveScreen from "../save";
import { renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";
import ProfileRedirect from "../(tabs)/profile";
import TabLayout from "../(tabs)/_layout";
import HomeScreen from "../(tabs)/index";
import { useHomeFeed } from "@/hooks/useHomeFeed";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader", email: "reader@example.com" }, signOut: jest.fn(async () => {}) }),
}));
jest.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    appearance: "light",
    interests: [],
    hiddenTopics: [],
    update: jest.fn(),
  }),
}));
jest.mock("@/components/CopiedLink", () => ({ CopiedLink: () => null }));
jest.mock("@/contexts/CaptureContext", () => ({ useCaptures: () => ({ captures: [], acknowledge: jest.fn(), drain: jest.fn(async () => {}), save: jest.fn(async () => "capture"), confirm: jest.fn(async () => {}), revision: 0 }) }));
jest.mock("@/hooks/useHomeFeed", () => ({ useHomeFeed: jest.fn() }));
jest.mock("@/hooks/useBookmarks", () => ({ useBookmarks: jest.fn(() => ({ bookmarks: [], isLoading: false, refresh: jest.fn(), loadMore: jest.fn() })) }));
jest.mock("@/lib/api", () => ({ BookmarksAPI: {} }));
jest.mock("@/lib/mobile-api", () => ({
  nativeBookmark: (value: unknown) => value,
  MobileAPI: { collections: jest.fn(async () => [{ id: "topic", name: "Design" }]), counts: jest.fn(async () => ({ all: 3, inbox: 1, archived: 1, collections: [] })), profile: jest.fn(async () => ({ name: "Reader", handle: "reader" })), publicSaves: jest.fn(async () => ({ bookmarks: [] })), updateProfile: jest.fn(async () => ({ name: "New Reader", handle: "reader" })) },
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
  renderRouter({ index: HomeScreen });
  const view = screen;
  fireEvent.press(view.getByText("AI"));
  expect(view.queryByText("Design article")).toBeNull();
  fireEvent.press(view.getByText("Following"));
  await waitFor(() => expect(view.getByText("Design article")).toBeTruthy());
  expect(view.queryByText("Good reading travels through people")).toBeNull();
});

// Router and tab primitives are real; auth/preferences/data are test boundaries.
it("offers Home, Save, Library in that order and opens Save over the current Library", async () => {
  const route = renderRouter({
    "(tabs)/_layout": TabLayout,
    "(tabs)/index": () => <Text>Home destination</Text>,
    "(tabs)/capture": () => <Text>Capture destination</Text>,
    "(tabs)/library": () => <Text>Library destination</Text>,
    "(tabs)/profile": () => <Text>Profile destination</Text>,
    "(tabs)/explore": () => <Text>Explore destination</Text>,
    save: () => <Text>Save modal</Text>,
  }, { initialUrl: "/" });
  expect(screen.getAllByLabelText(/, tab, /).map(tab => tab.props.accessibilityLabel.split(",")[0])).toEqual(["Home", "Save", "Library"]);
  fireEvent.press(screen.getByLabelText(/^Library, tab,/));
  expect(await screen.findByText("Library destination")).toBeTruthy();
  fireEvent.press(screen.getByLabelText(/^Save, tab,/));
  expect(await screen.findByText("Save modal")).toBeTruthy();
  expect(route.getPathname()).toBe("/save");
});

it("opens profile from the Home avatar outside tabs and returns to Home", async () => {
  const route = renderRouter({
    "(tabs)/_layout": TabLayout,
    "(tabs)/index": HomeScreen,
    "(tabs)/capture": () => <Text>Capture destination</Text>,
    "(tabs)/library": () => <Text>Library destination</Text>,
    "(tabs)/profile": () => <Text>Old profile destination</Text>,
    profile: () => <Text>Real profile destination</Text>,
  }, { initialUrl: "/" });
  fireEvent.press(screen.getByRole("button", { name: "Your profile" }));
  expect(await screen.findByText("Real profile destination")).toBeTruthy();
  expect(screen.queryByLabelText(/^Home, tab,/)).toBeNull();
  expect(route.getPathname()).toBe("/profile");
});

it("redirects the old profile-tab deep link to profile outside tabs", async () => {
  renderRouter({
    "(tabs)/_layout": TabLayout,
    "(tabs)/index": () => <Text>Home destination</Text>,
    "(tabs)/capture": () => <Text>Capture destination</Text>,
    "(tabs)/library": () => <Text>Library destination</Text>,
    "(tabs)/profile": ProfileRedirect,
    "(tabs)/explore": () => null,
    profile: () => <Text>Real profile destination</Text>,
  }, { initialUrl: "/(tabs)/profile" });
  expect(await screen.findByText("Real profile destination")).toBeTruthy();
  expect(screen.queryByLabelText(/^Home, tab,/)).toBeNull();
});

it("returns to the prior Library after confirming an existing Save modal", async () => {
  const route = renderRouter({
    _layout: () => <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="save" options={{ presentation: "modal" }} /></Stack>,
    "(tabs)/_layout": TabLayout,
    "(tabs)/index": () => <Text>Home destination</Text>,
    "(tabs)/capture": () => null,
    "(tabs)/library": () => <Text>Library destination</Text>,
    "(tabs)/profile": ProfileRedirect,
    "(tabs)/explore": () => null,
    profile: () => <Text>Real profile destination</Text>,
    save: SaveScreen,
  }, { initialUrl: "/(tabs)/library" });
  fireEvent.press(screen.getByLabelText(/^Save, tab,/));
  fireEvent.changeText(screen.getByLabelText("Link"), "https://example.com/reading");
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  fireEvent.press(await screen.findByRole("button", { name: "Done" }));
  await waitFor(() => expect(route.getPathname()).toBe("/library"));
  expect(screen.getByText("Library destination")).toBeTruthy();
});

it("keeps Library private and chronological with Topics and working read filters", async () => {
  renderRouter({ index: LibraryScreen, collections: () => <Text>Topics destination</Text> });
  expect(screen.getByText("Your private archive.")).toBeTruthy();
  expect(screen.getByText("Newest first")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "Unread" }));
  expect(useBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "library", readStatus: "unread", sort: "newest" }));
  fireEvent.press(screen.getByRole("button", { name: "Topics" }));
  expect(await screen.findByText("Topics destination")).toBeTruthy();
});

it("preserves real profile editing, settings and sign-out controls behind avatar and returns", async () => {
  renderRouter({
    "(tabs)/_layout": TabLayout, "(tabs)/index": HomeScreen,
    "(tabs)/capture": () => null, "(tabs)/library": LibraryScreen,
    "(tabs)/profile": ProfileRedirect, "(tabs)/explore": () => null,
    profile: ProfileScreen, settings: () => <Text>Settings destination</Text>,
  }, { initialUrl: "/" });
  fireEvent.press(screen.getByRole("button", { name: "Your profile" }));
  expect(await screen.findByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Your private library" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.changeText(screen.getByLabelText("Display name"), "New Reader");
  fireEvent.press(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(MobileAPI.updateProfile).toHaveBeenCalledWith("New Reader", undefined));
  await waitFor(() => expect(screen.queryByLabelText("Display name")).toBeNull());
  expect(screen.queryByText(/Accent|Density|Layout exploration/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Go back" }));
  expect(await screen.findByRole("button", { name: "Your profile" })).toBeTruthy();
});

it("uses Topics copy while preserving Inbox, Archive and the existing topic tree", async () => {
  renderRouter({ index: CollectionsScreen, "(tabs)/library": LibraryScreen });
  expect(await screen.findByText("Design")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Topics" })).toBeTruthy();
  expect(screen.getByText("Inbox")).toBeTruthy();
  fireEvent.press(screen.getByText("Archive"));
  expect(await screen.findByRole("header", { name: "Archive" })).toBeTruthy();
  expect(useBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "archive", sort: "newest" }));
});

it("shows the signed-in reader initial in the Home avatar", async () => {
  renderRouter({ index: HomeScreen });
  expect(screen.getByRole('button', { name: 'Your profile' })).toBeTruthy();
  expect(screen.getByText('R')).toBeTruthy();
});

it('returns to Home after a cold legacy profile deep link has no previous screen', async () => {
  renderRouter({ '(tabs)/_layout': TabLayout, '(tabs)/index': HomeScreen,
    '(tabs)/library': LibraryScreen, '(tabs)/capture': () => null, '(tabs)/explore': () => null,
    '(tabs)/profile': ProfileRedirect, profile: ProfileScreen }, { initialUrl: '/(tabs)/profile' });
  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
  expect(await screen.findByRole('button', { name: 'Your profile' })).toBeTruthy();
});
