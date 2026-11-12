import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Bookmark } from "@/lib/api";
import { MobileAPI } from "@/lib/mobile-api";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
export function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
export function Recommendation({
  bookmark,
  compact = false,
}: {
  bookmark: Bookmark;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { invalidate } = useCaptures();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const kept = saved || bookmark.userId === user?.id;
  const save = async () => {
    if (kept || busy) return;
    setBusy(true);
    try {
      await MobileAPI.saveRecommendation(bookmark.id);
      setSaved(true);
      invalidate();
    } catch {
      Alert.alert("Link was not saved", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Pressable
        style={{ flex: 1, gap: space.s2, minHeight: 44 }}
        accessibilityRole="button"
        accessibilityLabel={`Read ${bookmark.title || domain(bookmark.sourceUrl)}`}
        onPress={() => router.push(`/bookmark/${bookmark.id}`)}
      >
        <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
          {domain(bookmark.sourceUrl)}
          {bookmark.metadata?.readingTime
            ? ` · ${bookmark.metadata.readingTime} min`
            : ""}
          {kept ? " · In your library" : ""}
        </Text>
        <Text
          style={[
            textStyle(compact ? "title3" : "title2"),
            { color: colors.fg },
          ]}
        >
          {bookmark.title || domain(bookmark.sourceUrl)}
        </Text>
        {!compact &&
        (bookmark.cosmicBriefSummary ||
          bookmark.metadata?.openGraph?.description) ? (
          <Text
            numberOfLines={3}
            style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
          >
            {bookmark.cosmicBriefSummary ||
              bookmark.metadata?.openGraph?.description}
          </Text>
        ) : null}
        {bookmark.processingStatus === "processing" ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[textStyle("meta"), { color: colors.fgSecondary }]}
          >
            Cosmic is reading it…
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={save}
        disabled={kept || busy}
        accessibilityRole="button"
        accessibilityLabel={
          kept
            ? "Saved to Library"
            : `Save ${bookmark.title || "link"} to Library`
        }
        accessibilityState={{ disabled: kept || busy, busy }}
        style={styles.save}
      >
        <Ionicons
          name={kept ? "checkmark" : busy ? "ellipsis-horizontal" : "add"}
          size={22}
          color={colors.fgSecondary}
        />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.s2,
    paddingVertical: space.s4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  save: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
