import { fireEvent, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";
import { Animated } from "react-native";

import { LaunchSplash } from "../LaunchSplash";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReducedMotion }));
let mockReducedMotion = false;

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockReducedMotion = false;
});

test("hands off from the native mark after layout, then exits when the route is ready", () => {
  const start = jest.fn();
  const timing = jest.spyOn(Animated, "timing").mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() });
  const onFinished = jest.fn();
  const view = render(<LaunchSplash ready={false} onFinished={onFinished} />);

  fireEvent(view.getByTestId("launch-mark", { includeHiddenElements: true }), "loadEnd");
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  fireEvent(view.getByTestId("launch-splash", { includeHiddenElements: true }), "layout");
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(timing).not.toHaveBeenCalled();

  view.rerender(<LaunchSplash ready onFinished={onFinished} />);
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 640, useNativeDriver: true }));
  start.mock.calls[0][0]({ finished: true });
  expect(onFinished).toHaveBeenCalledTimes(1);
});

test("reduces the exit to a short crossfade and can still open if the mark did not load", () => {
  mockReducedMotion = true;
  const timing = jest.spyOn(Animated, "timing").mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const view = render(<LaunchSplash ready onFinished={jest.fn()} />);
  fireEvent(view.getByTestId("launch-splash", { includeHiddenElements: true }), "layout");

  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 150 }));
});
