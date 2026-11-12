import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Bookmark } from "@/lib/api";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { domain } from "./Recommendation";
export function BookmarkCard({
  bookmark,
  onPress,
  onToggleRead,
  showReadStatus = false,
  onActions,
}: {
  bookmark: Bookmark;
  onPress?: (bookmark: Bookmark) => void;
  onToggleRead?: (bookmark: Bookmark) => void;
  showReadStatus?: boolean;
  onActions?: (bookmark: Bookmark) => void;
}) {
  const { colors } = useTheme();
  const read = bookmark.isRead ?? Boolean(bookmark.readAt);
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {showReadStatus ? (
        <View style={{ width: space.s2, paddingTop: space.s3 }}>
          <View
            accessibilityLabel={read ? "Read" : "Unread"}
            style={{
              width: 6,
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: read ? "transparent" : colors.accent,
            }}
          />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress?.(bookmark)}
        style={{ flex: 1, gap: space.s2, minHeight: 44 }}
      >
        <Text
          style={[textStyle("title2"), { color: colors.fg }]}
          numberOfLines={2}
        >
          {bookmark.title || domain(bookmark.sourceUrl)}
        </Text>
        {bookmark.cosmicBriefSummary ||
        bookmark.metadata?.openGraph?.description ? (
          <Text
            style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
            numberOfLines={2}
          >
            {bookmark.cosmicBriefSummary ||
              bookmark.metadata?.openGraph?.description}
          </Text>
        ) : null}
        <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
          {domain(bookmark.sourceUrl)}
          {bookmark.metadata?.readingTime
            ? ` · ${bookmark.metadata.readingTime} min read`
            : ""}
        </Text>
        <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>
          {bookmark.collectionPath?.map((part) => part.name).join(" / ") ||
            "Inbox"}
          {bookmark.processingStatus === "processing"
            ? " · Cosmic is reading it…"
            : ""}
          {bookmark.processingStatus === "failed"
            ? " · Processing needs a retry"
            : ""}
        </Text>
      </Pressable>
      {onActions ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${bookmark.title || "save"}`}
          onPress={() => onActions(bookmark)}
          style={styles.action}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.fgSecondary}
          />
        </Pressable>
      ) : onToggleRead ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={read ? "Mark unread" : "Mark read"}
          onPress={() => onToggleRead(bookmark)}
          style={styles.action}
        >
          <Ionicons
            name={read ? "checkmark-circle" : "checkmark-circle-outline"}
            size={22}
            color={colors.fgSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.s2,
    paddingHorizontal: space.s5,
    paddingVertical: space.s4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  action: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
