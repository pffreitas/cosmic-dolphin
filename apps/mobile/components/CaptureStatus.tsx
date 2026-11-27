import { CaptureSource, CapturePlatform, type Bookmark as ContractBookmark, type BookmarkProcessingEvent } from "@cosmic-dolphin/api-client";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCaptures, type Capture } from "@/contexts/CaptureContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { MobileAPI } from "@/lib/mobile-api";
import { Button, layout } from "./ui/Signal";
import type { Bookmark } from "@/lib/api";
import { FeedCard, type FeedCardActions } from "./FeedCard";
import { Copy, Action } from "./web-home/Primitives";
import { Favicon } from "./web-home/FeedItem";
import { domainFor } from "./web-home/data";
import { useWebTheme } from "./web-home/theme";
import { radius } from "@/constants/theme";
import { PendingPhases } from "./PendingPhases";
import { webText } from "./web-home/theme";
function CaptureRow({ capture, onCompleted, failedActions, appearance }: { appearance?: "web"; capture: Capture; onCompleted?: () => void; failedActions?: (bookmark: ContractBookmark) => FeedCardActions }) {
  const { retry, remove, updateBookmark } = useCaptures();
  const { colors } = useTheme();
  const { colors: webColors } = useWebTheme();
  const router = useRouter();
  const [filingPath, setFilingPath] = useState<string>();
  const [events, setEvents] = useState<BookmarkProcessingEvent[]>([]);
  const id = capture.bookmark?.id;
  const processing = capture.bookmark?.processingStatus === "processing";
  useEffect(() => {
    if (!id || !processing) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const timeline = await MobileAPI.processingTimeline(id, controller.signal, capture.entry.userId);
        if (controller.signal.aborted) return;
        setEvents(timeline.events);
        setFilingPath(timeline.bookmark.collectionPath?.map(part => part.name).join(" › "));
        if (onCompleted) {
          if (timeline.bookmark.processingStatus !== "processing") onCompleted();
        } else updateBookmark(capture.id, timeline.bookmark);
        if (timeline.bookmark.processingStatus === "processing") timer = setTimeout(load, Math.max(250, timeline.pollAfterMs));
      } catch { if (!controller.signal.aborted) timer = setTimeout(load, 5000); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, processing, capture.id, capture.entry.userId, updateBookmark, onCompleted]);
  if (appearance === "web") {
    const title = capture.bookmark?.title || capture.entry.title || capture.entry.url;
    const active = [...events].reverse().find(event => event.kind === "phase" && (event.status === "running" || event.status === "failed"));
    const label = active?.phase === "summarise" ? "Summarising…" : active?.phase === "extract" ? "Extracting content…" : active?.phase === "tag" ? "Tagging…" : active?.phase === "file" ? "Filing into a collection…" : "Saving…";
    return <View accessibilityLiveRegion="polite" style={{ borderWidth: 1, borderRadius: radius.md, borderColor: webColors.border, backgroundColor: webColors.bgSubtle, paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Favicon domain={domainFor(capture.entry.url)} /><Pressable disabled={!capture.bookmark} accessibilityRole="button" accessibilityLabel={`Open ${title}`} accessibilityHint={filingPath || capture.bookmark?.collectionPath?.map(part => part.name).join(" › ")} onPress={() => router.push(`/bookmark/${capture.bookmark!.id}`)} style={{ flex: 1 }}><Text numberOfLines={1} style={[webText("saving"), { color: webColors.fg }]}>{title}</Text></Pressable><Copy role="meta" style={{ color: webColors.fgTertiary }}>just now</Copy></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        {processing ? <View style={{ width: 14, height: 14, borderWidth: 1.5, borderColor: webColors.accent, borderRightColor: "transparent", borderRadius: radius.pill }} /> : null}
        <Copy role="meta" style={processing ? { color: webColors.fg } : undefined}>{capture.status === "failed" ? "Couldn't save this link" : capture.status === "queued" ? "Saved on this phone. Cosmic reads it when you open the app." : processing ? label : capture.alreadySaved ? "Already in your Library" : "Saved privately to your Library"}</Copy>
      </View>
      {capture.status === "failed" ? <View style={{ flexDirection: "row", gap: 8 }}>
        {capture.entry.failure !== "rejected" ? <Action label="Retry" onPress={() => retry(capture.id)}>Retry</Action> : null}
        <Action label="Remove" onPress={() => remove(capture.id)}>Remove</Action>
      </View> : null}
    </View>;
  }
  if (capture.bookmark?.processingStatus === "failed") {
    const saved = capture.bookmark;
    const bookmark = { ...saved, createdAt: new Date(saved.createdAt), updatedAt: new Date(saved.updatedAt), readAt: saved.readAt ? new Date(saved.readAt) : undefined, laterUntil: saved.laterUntil ? new Date(saved.laterUntil) : saved.laterUntil, captureQueuedAt: saved.captureQueuedAt ? new Date(saved.captureQueuedAt) : saved.captureQueuedAt } as ContractBookmark;
    return <FeedCard item={{ type: "own_save", bookmark }} actions={failedActions?.(bookmark)} />;
  }
  const failed = capture.status === "failed";
  const queued = capture.status === "queued";
  const path = capture.bookmark?.collectionPath?.map(part => part.name).join(" › ");
  return <View style={[layout.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]} accessibilityLiveRegion="polite" accessibilityLabel={failed ? "Unsent save" : processing ? "Saving now" : undefined}>
    <Text style={[textStyle("title1"), { color: colors.fg }]}>{capture.bookmark?.title || capture.entry.title || capture.entry.url}</Text>
    <Text style={[textStyle("bodySm"), { color: failed ? colors.danger : colors.fgSecondary }]}>
      {failed ? "Couldn't save this link" : queued ? "Saved on this phone. Cosmic reads it when you open the app." : capture.status === "saving" ? "Saving…" : capture.alreadySaved ? "Already in your Library" : processing ? "Cosmic is reading it" : "Saved privately to your Library"}
    </Text>
    {processing ? <PendingPhases events={events} privateLink={capture.entry.isPrivateLink} /> : null}
    {path ? <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>{path}</Text> : null}
    {failed ? <>
      {capture.entry.failure !== "rejected" ? <Button title="Retry" onPress={() => retry(capture.id)} /> : null}
      <Button title="Remove" onPress={() => remove(capture.id)} />
    </> : capture.bookmark ? <Button title="Open save" onPress={() => router.push(`/bookmark/${capture.bookmark!.id}`)} /> : null}
  </View>;
}
export function CaptureStatus({ loadedIds = [], pendingBookmarks = [], onCompleted, failedActions, appearance }: { appearance?: "web"; loadedIds?: string[]; pendingBookmarks?: Bookmark[]; onCompleted?: () => void; failedActions?: (bookmark: ContractBookmark) => FeedCardActions }) {
  const { captures, acknowledge, revision } = useCaptures();
  const ids = loadedIds.join("\0");
  useEffect(() => { acknowledge(ids.split("\0")); }, [ids, acknowledge, revision]);
  return <>
    {captures.filter(capture => !capture.bookmark || capture.bookmark.processingStatus === "processing" || !loadedIds.includes(capture.bookmark.id)).map(capture => <CaptureRow appearance={appearance} key={capture.id} capture={capture} failedActions={failedActions} />)}
    {pendingBookmarks.filter(bookmark => !captures.some(capture => capture.bookmark?.id === bookmark.id)).map(bookmark => <CaptureRow appearance={appearance} key={`feed:${bookmark.id}`} onCompleted={onCompleted} failedActions={failedActions} capture={{
      id: `feed:${bookmark.id}`, status: "saved", bookmark,
      entry: { id: bookmark.id, url: bookmark.sourceUrl, userId: bookmark.userId, queuedAt: bookmark.createdAt,
        captureSource: Object.values(CaptureSource).find(value => value === bookmark.captureSource) ?? CaptureSource.SaveSheet, capturePlatform: Object.values(CapturePlatform).find(value => value === bookmark.capturePlatform) ?? CapturePlatform.Unknown, attempts: 1 },
    }} />)}
  </>;
}
