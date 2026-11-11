import React, { useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space } from "@/constants/theme";
import { Notice } from "./ui/Signal";

/** Capture confirmation only. Undo and later card actions belong to their task. */
export function CaptureFailureToast({ message }: { message?: string }) {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  if (!message) return null;
  return <SafeAreaView edges={["bottom"]} accessible accessibilityRole="alert" accessibilityLabel={message}
    style={{ position: "absolute", left: space.s5, right: space.s5, bottom: 0, paddingBottom: space.s5 }}>
    <Notice message={message} error />
  </SafeAreaView>;
}
