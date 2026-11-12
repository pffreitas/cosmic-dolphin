import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { DailyPick } from "@cosmic-dolphin/api-client";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
export function TodayProgress({ items }: { items: DailyPick[] }) {
  const { colors } = useTheme();
  if (!items.length) return null;
  const done = items.filter(item => item.bookmark.readAt).length;
  const allDone = done === items.length;
  const hasTimes = items.every(item => typeof item.bookmark.metadata?.readingTime === "number" && Number.isFinite(item.bookmark.metadata.readingTime) && item.bookmark.metadata.readingTime > 0);
  const left = items.filter(item => !item.bookmark.readAt).reduce((total, item) => total + (item.bookmark.metadata?.readingTime ?? 0), 0);
  const total = items.reduce((sum, item) => sum + (item.bookmark.metadata?.readingTime ?? 0), 0);
  return <View style={[styles.progress, { borderColor: colors.border }]} accessibilityLiveRegion="polite">
    <View style={styles.row}>
      <Text style={[textStyle("bodySm"), { color: allDone ? colors.success : colors.fg }]}>{allDone ? `All ${items.length} done` : "Today's 5"}</Text>
      <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>{allDone
        ? (hasTimes ? `${total} minutes of reading cleared today` : "")
        : `${done} of ${items.length} done${hasTimes ? ` · ${left} min left` : ""}`}</Text>
    </View>
    <View style={styles.row}>{items.map(item => <View key={item.position} style={[styles.segment, { backgroundColor: item.bookmark.readAt ? (allDone ? colors.success : colors.accent) : colors.borderStrong }]} />)}</View>
  </View>;
}
const styles = StyleSheet.create({
  progress: { paddingHorizontal: space.s4, paddingVertical: space.s3, gap: space.s2, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: space.s2 },
  segment: { height: space.s1, borderRadius: radius.xs, flex: 1 },
});

export function TodaySkeleton() {
  const { colors } = useTheme();
  const bar = { backgroundColor: colors.bgInset, borderRadius: radius.xs };
  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading content">
    <View style={[styles.progress, { borderColor: colors.border }]}>
      <View style={[bar, { width: "40%", height: space.s3 }]} />
      <View testID="today-skeleton-bar" style={[bar, { height: space.s1 }]} />
    </View>
    {[0, 1, 2].map(index => <View key={index} testID="today-skeleton-row" style={{ paddingVertical: space.s5, paddingHorizontal: space.s4, gap: space.s3, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
      {[55, 90, 80].map((width, line) => <View key={line} style={[bar, { width: `${width}%`, height: line === 1 ? space.s5 : space.s3 }]} />)}
    </View>)}
  </View>;
}
