import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Button, layout, Screen } from "@/components/ui/Signal";
import { useCaptures } from "@/contexts/CaptureContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";

/** Android receives a durable capture ID, never a second save or preview request. */
export default function ShareScreen() {
  const { captureId, noUrl, error, queued: phoneSaved } = useLocalSearchParams<{ captureId?: string; noUrl?: string; error?: string; queued?: string }>();
  const { captures, remove, retry } = useCaptures();
  const { colors } = useTheme();
  const capture = captures.find(value => value.id === captureId);
  const queued = !!phoneSaved || !!capture && capture.entry.attempts > 0 &&
    ((capture.status === "failed" && capture.entry.failure === "retry") || capture.status === "queued");
  const [screenReader, setScreenReader] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (mounted) setScreenReader(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closed = useRef(false);
  useEffect(() => { closed.current = false; }, [captureId, noUrl, error]);
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    clearTimeout(timer.current);
    if (Platform.OS === "android") BackHandler.exitApp();
  }, []);
  const rejected = capture?.entry.failure === "rejected";
  const message = noUrl ? "Cosmic Dolphin can only save links" : error ?? (rejected ? "Couldn't save this link" :
    (capture?.status === "saved" ? capture.alreadySaved ? "Already in your Library" : "Saved to Cosmic Dolphin" : queued ? "Saved on this phone. Cosmic reads it when you open the app." : "Saving…"));
  useEffect(() => {
    if (closed.current || Platform.OS !== "android" || screenReader || (capture?.status !== "saved" && !queued)) return;
    timer.current = setTimeout(close, 1500);
    return () => clearTimeout(timer.current);
  }, [capture?.status, captureId, queued, screenReader, close]);
  useEffect(() => {
    if (screenReader) AccessibilityInfo.announceForAccessibility(message);
  }, [message, screenReader]);
  return <Screen title="Cosmic Dolphin">
    <ScrollView contentContainerStyle={layout.content}>
      <View accessibilityLiveRegion="polite">
        <Text style={[textStyle("body"), { color: colors.fg }]}>{message}</Text>
      </View>
      {capture?.entry.url ? <Text style={[textStyle("title1"), { color: colors.fg }]}>{capture.entry.url}</Text> : null}
      {capture?.status === "saved" && !capture.alreadySaved ? <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>You can close the tab now. Cosmic reads it next.</Text> : null}
      {capture?.status === "failed" && !rejected && captureId ? <Button title="Retry" onPress={() => retry(captureId)} /> : null}
      {(rejected || capture?.status === "failed") && captureId ? <Button title="Remove" onPress={() => remove(captureId)} /> : null}
      <Button title="Close" onPress={close} />
    </ScrollView>
  </Screen>;
}
