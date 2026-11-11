import React from "react";
import { Alert, Text, View } from "react-native";
import { openBrowserAsync } from "expo-web-browser";
import type { ProcessingFailureCode } from "@cosmic-dolphin/api-client";
import { space } from "@/constants/theme";
import { textStyle } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";
import { Button, layout, Notice } from "./ui/Signal";

const reasons: Record<ProcessingFailureCode, string> = {
  paywall: "it needs a subscription",
  auth: "it asks you to sign in",
  blocked: "the site didn't let Cosmic read it",
  empty: "the page had no article text",
  unsupported: "Cosmic can't read this kind of page yet",
  unavailable: "the page wasn't available",
  provider: "Cosmic couldn't reach it just now",
};
export function openOriginal(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Invalid source");
    void openBrowserAsync(url).catch(() => Alert.alert("Could not open original", "Please try again."));
  } catch { Alert.alert("Could not open original", "Please try again."); }
}
export function BookmarkFailure({ code, url, page, privateLink, onPaste, onRetry }: {
  code?: ProcessingFailureCode | null; url: string; page?: boolean; privateLink?: boolean;
  onPaste: () => void; onRetry: () => void;
}) {
  const { colors } = useTheme();
  const reason = code && reasons[code];
  if (!reason) return <Notice message="The brief could not be prepared. Your original link is still available." error action="Retry" onAction={onRetry} />;
  return <View style={{ gap: space.s2 }} accessibilityLiveRegion="polite">
    <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{`Cosmic couldn't read this page because ${reason}. Your link is safe.`}</Text>
    {page ? <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>Nothing is guessed from the headline.</Text> : null}
    <View style={layout.row}>
      <Button title="Open original" icon="open-outline" primary={page && code !== "provider"} onPress={() => openOriginal(url)} />
      {code === "provider" ? <Button title="Try again" primary={page} onPress={onRetry} /> : !privateLink ? <Button title="Paste the text" icon="clipboard-outline" onPress={onPaste} /> : null}
    </View>
  </View>;
}
