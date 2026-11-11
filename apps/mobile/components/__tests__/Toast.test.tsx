import React, { useSyncExternalStore } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Text, StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BookmarkFromJSON } from "@cosmic-dolphin/api-client";
import { BookmarkActions } from "@/lib/bookmark-actions";
import { Toast } from "../Toast";
import { SwipeableCard } from "../SwipeableCard";
import { TodayProgress } from "../TodayProgress";
import { Button } from "../ui/Signal";

jest.mock("@/contexts/PreferencesContext", () => ({ usePreferences: () => ({ appearance: "light" }) }));
jest.mock("@/lib/mobile-api", () => ({ MobileAPI: { read: jest.fn(async () => ({})) } }));
function Status({ controller }: { controller: BookmarkActions }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return <Toast message={state.toast?.message} undo={state.toast?.undo} close={controller.closeToast} />;
}
const b = () => BookmarkFromJSON({ id: "one", userId: "reader", sourceUrl: "https://one.example", createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z" });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
it("screen-reader status is announced and remains after exactly 8s with expired Undo removed", async () => {
  jest.useFakeTimers(); const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
  const controller = new BookmarkActions("reader"); controller.setScreenReader(true);
  render(<Status controller={controller} />); act(() => controller.done(b()));
  expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  expect(announce).toHaveBeenCalledWith("Marked done");
  act(() => jest.advanceTimersByTime(8000));
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(screen.getByText("Marked done").props.accessibilityLiveRegion).toBe("polite");
  expect(announce).toHaveBeenCalledTimes(1);
  act(() => controller.navigationAway()); expect(screen.queryByText("Marked done")).toBeNull();
});
it("the visible Close status control dismisses the status and Undo without extending the window", async () => {
  const close = jest.fn(); render(<Toast message="Marked done" undo={() => {}} close={close} />);
  fireEvent.press(screen.getByRole("button", { name: "Close status" })); expect(close).toHaveBeenCalledTimes(1);
});
it("a new toast replaces retained screen-reader status without restoring expired Undo", async () => {
  jest.useFakeTimers(); const controller = new BookmarkActions("reader"); controller.setScreenReader(true);
  render(<Status controller={controller} />); act(() => controller.done(b())); act(() => jest.advanceTimersByTime(8000));
  act(() => controller.done(b()));
  expect(screen.queryByText("Marked done")).toBeNull(); expect(screen.getByText("Marked not done")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Close status" })); expect(screen.queryByText("Marked not done")).toBeNull();
});
it("Later control labels wrap in growing rows while status content stays uncapped", async () => {
  render(<Button title="This weekend" detail="Sun, 9 am" onPress={() => {}} />);
  expect(screen.getByText("This weekend").props.numberOfLines).toBeUndefined();
  expect(screen.getByText("Sun, 9 am").props.numberOfLines).toBeUndefined();
  const style = StyleSheet.flatten(screen.getByRole("button", { name: "This weekend, Sun, 9 am" }).props.style);
  expect(style.height).toBeUndefined(); expect(style.flexWrap).toBe("wrap");
  render(<Toast message="A long status remains uncapped at large text sizes" />);
  expect(screen.getByText("A long status remains uncapped at large text sizes").props.maxFontSizeMultiplier).toBeUndefined();
});

it("Reduce Motion has no fly-out, animated bar fill, spinner rotation or countdown", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  const timing = jest.spyOn(Animated, "timing"); const loop = jest.spyOn(Animated, "loop");
  const done = jest.fn();
  const view = render(<><Button title="Saving" busy onPress={() => {}} /><SwipeableCard id="one" done={done} tonight={() => {}}><Text>Fictional card</Text></SwipeableCard><TodayProgress items={[{ position: 1, bookmark: b(), reason: "Original reason" }]} /><Toast message="Marked done" undo={() => {}} /></>);
  await act(async () => {});
  expect(view.UNSAFE_queryAllByType(ActivityIndicator).every(node => node.props.animating === false)).toBe(true);
  const card = screen.getByTestId("swipe-card-one");
  fireEvent(card, "touchStart", { nativeEvent: { pageX: 100, pageY: 100 } });
  fireEvent(card, "responderRelease", { nativeEvent: { pageX: 180, pageY: 100 } });
  expect(done).toHaveBeenCalledTimes(1); expect(timing).not.toHaveBeenCalled(); expect(loop).not.toHaveBeenCalled();
  expect(screen.queryByText(/\d+\s*(seconds|s) left/)).toBeNull();
});
