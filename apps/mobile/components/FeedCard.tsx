import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedItem } from "@cosmic-dolphin/api-client";
import { useRouter } from "expo-router";
import { Button } from "./ui/Signal";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { SwipeableCard } from "./SwipeableCard";
import { useControlFocus } from "@/hooks/useControlFocus";

/** T-7 supplies the mutation controller; presentation never manufactures state. */
export interface FeedCardActions {
  done?: () => void;
  later?: () => void;
  tonight?: () => void;
  more?: () => void;
  save?: () => void;
}
export function readingMinutes(item: FeedItem): number | undefined {
  const value = item.bookmark?.metadata?.readingTime;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
export function FeedCard({ item, today, actions = {} }: { item: FeedItem; today?: boolean; actions?: FeedCardActions }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { focusStyle, ...focusEvents } = useControlFocus();
  const bookmark = item.bookmark;
  if (item.type === "digest" && item.digest) {
    const digest = item.digest;
    return <View testID={`feed-card-${digest.id}`} style={[styles.card, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
      {item.rankingReason ? <Text testID="ranking-reason" style={[textStyle("meta"), { color: colors.fgTertiary }]}>{item.rankingReason}</Text> : null}
      <Pressable {...focusEvents} style={focusStyle} accessibilityRole="button" accessibilityLabel={`Open ${digest.title}`} onLongPress={actions.more} onPress={() => router.push({ pathname: "/topic", params: { id: `digest:${digest.id}` } })}>
        <Text style={[textStyle("title1"), { color: colors.fg }]}>{digest.title}</Text>
      </Pressable>
      <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{digest.summary}</Text>
      {digest.keyPoints.map((point, index) => <Text key={index} style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{point.text}</Text>)}
      <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>Built from</Text>
      {digest.sources.map(source => <Button key={source.bookmarkId} title={source.title} detail={source.domain} onPress={() => router.push(`/bookmark/${source.bookmarkId}`)} />)}
    </View>;
  }
  if (!bookmark) return null;
  const own = item.type === "own_save" || item.type === "pending";
  let domain = bookmark.sourceUrl;
  try { domain = new URL(bookmark.sourceUrl).hostname.replace(/^www\./, ""); } catch {}
  const minutes = readingMinutes(item);
  const image = bookmark.metadata?.openGraph?.image;
  return <SwipeableCard id={bookmark.id} done={own ? actions.done : undefined} tonight={own ? actions.tonight : undefined}><View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]} testID={`feed-card-${bookmark.id}`}>
    {item.rankingReason ? <Text testID="ranking-reason" style={[textStyle("meta"), { color: colors.fgTertiary }]}>{item.rankingReason}</Text> : null}
    <View style={styles.row}>
      <Text style={[textStyle("meta"), { color: colors.fgSecondary, flex: 1 }]}>{own ? `${domain} · saved` : `${item.actor?.name || item.actor?.handle || domain} · ${item.type === "reshare" ? "reshared" : "shared"} · ${domain}`}</Text>
      {today ? <Text style={[textStyle("meta"), styles.today, { color: colors.fg, backgroundColor: colors.accentSoft }]}>Today</Text> : null}
    </View>
    <Pressable {...focusEvents} accessibilityRole="button" accessibilityLabel={`Open ${bookmark.title || domain}`}
      accessibilityActions={own ? [{ name: "done", label: "Mark done" }, { name: "later", label: "Later" }, { name: "more", label: "More actions" }] : [{ name: "more", label: "More actions" }]}
      onAccessibilityAction={event => { const name = event.nativeEvent.actionName; if (own && name === "done") actions.done?.(); else if (own && name === "later") actions.later?.(); else if (name === "more") actions.more?.(); }} onPress={() => router.push(`/bookmark/${bookmark.id}`)} onLongPress={actions.more} style={focusStyle}>
      <Text style={[textStyle("title1"), { color: colors.fg }]}>{bookmark.title || domain}</Text>
    </Pressable>
    {bookmark.cosmicBriefSummary ? <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{bookmark.cosmicBriefSummary}</Text> : null}
    {image ? <Image source={{ uri: image }} accessibilityIgnoresInvertColors style={styles.media} /> : null}
    <View style={styles.row}>
      <Text style={[textStyle("meta"), { color: colors.fgTertiary, flex: 1 }]}>{minutes ? `${minutes} min read` : domain}</Text>
      {own ? <>
        <Button title="Later" icon="time-outline" disabled={!actions.later} onPress={() => actions.later?.()} />
        <Button title="Done" icon={bookmark.readAt ? "checkmark-circle-outline" : "checkmark-outline"} disabled={!actions.done} onPress={() => actions.done?.()} />
      </> : <Button title="Save to Library" disabled={!actions.save} onPress={() => actions.save?.()} />}
      <Button title="More actions" icon="ellipsis-horizontal" disabled={!actions.more} onPress={() => actions.more?.()} />
    </View>
  </View></SwipeableCard>;
}
const styles = StyleSheet.create({
  card: { padding: space.s4, gap: space.s2, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s1 },
  today: { borderRadius: radius.pill, paddingHorizontal: space.s2, paddingVertical: space.s1 },
  media: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md },
});
