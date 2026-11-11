/* eslint-disable @typescript-eslint/no-require-imports -- Native component mocks require the initialized test runtime. */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { CopiedLink } from "../CopiedLink";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
const mockHasUrl = jest.fn(async () => true);
const mockText = jest.fn(async () => "https://example.com/copied");
jest.mock("expo-clipboard", () => ({ isPasteButtonAvailable: true, hasUrlAsync: jest.fn(async () => true), getStringAsync: () => mockText(), ClipboardPasteButton: () => null }));
jest.mock("expo-modules-core", () => ({ ...jest.requireActual("expo-modules-core"), requireOptionalNativeModule: () => ({ hasUrl: mockHasUrl }) }));
afterEach(() => { jest.restoreAllMocks(); mockText.mockClear(); mockHasUrl.mockClear(); });
it("Android copied-link detection uses native metadata and reads text only on the explicit Paste tap", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const paste = jest.fn();
  const app = render(<CopiedLink onPaste={paste} />);
  expect(await app.findByText("Paste copied link")).toBeTruthy();
  expect(mockHasUrl).toHaveBeenCalled();
  expect(mockText).not.toHaveBeenCalled();
  fireEvent.press(app.getByRole("button", { name: "Paste" }));
  await waitFor(() => expect(paste).toHaveBeenCalledWith("https://example.com/copied"));
  expect(mockText).toHaveBeenCalledTimes(1);
});
it("iOS 15 hides the copied-link row and never probes or reads its clipboard", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  jest.replaceProperty(Clipboard, "isPasteButtonAvailable", false);
  const app = render(<CopiedLink onPaste={jest.fn()} />);
  expect(app.queryByText("Paste copied link")).toBeNull();
  expect(mockText).not.toHaveBeenCalled();
  expect(Clipboard.hasUrlAsync).not.toHaveBeenCalled();
});
it("no detected URL shows no copied-link row without reading the clipboard", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  mockHasUrl.mockResolvedValueOnce(false);
  const app = render(<CopiedLink onPaste={jest.fn()} />);
  await waitFor(() => expect(mockHasUrl).toHaveBeenCalled());
  expect(app.queryByText("Paste copied link")).toBeNull();
  expect(mockText).not.toHaveBeenCalled();
});
it("Save keeps its busy control label capped and wrappable while Reduce Motion stops the indicator", async () => {
  const { AccessibilityInfo, ActivityIndicator, Text } = require("react-native");
  const { Button } = require("../ui/Signal");
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  const app = render(<Button title="Save" busy onPress={jest.fn()} />);
  await waitFor(() => expect(app.UNSAFE_getByType(ActivityIndicator).props.animating).toBe(false));
  expect(app.getByRole("button", { name: "Save" }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  const label = app.UNSAFE_getAllByType(Text).find((text: any) => text.props.children === "Save");
  expect(label!.props.numberOfLines).toBeUndefined();
  expect(label!.props.maxFontSizeMultiplier).toBe(1.3);
});
