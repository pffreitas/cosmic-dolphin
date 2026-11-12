import { CaptureSource, CapturePlatform, type Bookmark as ContractBookmark, type BookmarkProcessingEvent } from "@cosmic-dolphin/api-client";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCaptures, type Capture } from "@/contexts/CaptureContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { MobileAPI } from "@/lib/mobile-api";
import { Button, layout } from "./ui/Signal";
import type { Bookmark } from "@/lib/api";
import { FeedCard, type FeedCardActions } from "./FeedCard";
import { PendingPhases } from "./PendingPhases";
function CaptureRow({ capture, onCompleted, failedActions }: { capture: Capture; onCompleted?: () => void; failedActions?: (bookmark: ContractBookmark) => FeedCardActions }) {
  const { retry, remove, updateBookmark } = useCaptures();
  const { colors } = useTheme();
  const router = useRouter();
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
        if (onCompleted) {
          if (timeline.bookmark.processingStatus !== "processing") onCompleted();
        } else updateBookmark(capture.id, timeline.bookmark);
        if (timeline.bookmark.processingStatus === "processing") timer = setTimeout(load, Math.max(250, timeline.pollAfterMs));
      } catch { if (!controller.signal.aborted) timer = setTimeout(load, 5000); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, processing, capture.id, capture.entry.userId, updateBookmark, onCompleted]);
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
export function CaptureStatus({ loadedIds = [], pendingBookmarks = [], onCompleted, failedActions }: { loadedIds?: string[]; pendingBookmarks?: Bookmark[]; onCompleted?: () => void; failedActions?: (bookmark: ContractBookmark) => FeedCardActions }) {
  const { captures, acknowledge, revision } = useCaptures();
  const ids = loadedIds.join("\0");
  useEffect(() => { acknowledge(ids.split("\0")); }, [ids, acknowledge, revision]);
  return <>
    {captures.filter(capture => !capture.bookmark || capture.bookmark.processingStatus === "processing" || !loadedIds.includes(capture.bookmark.id)).map(capture => <CaptureRow key={capture.id} capture={capture} failedActions={failedActions} />)}
    {pendingBookmarks.filter(bookmark => !captures.some(capture => capture.bookmark?.id === bookmark.id)).map(bookmark => <CaptureRow key={`feed:${bookmark.id}`} onCompleted={onCompleted} failedActions={failedActions} capture={{
      id: `feed:${bookmark.id}`, status: "saved", bookmark,
      entry: { id: bookmark.id, url: bookmark.sourceUrl, userId: bookmark.userId, queuedAt: bookmark.createdAt,
        captureSource: Object.values(CaptureSource).find(value => value === bookmark.captureSource) ?? CaptureSource.SaveSheet, capturePlatform: Object.values(CapturePlatform).find(value => value === bookmark.capturePlatform) ?? CapturePlatform.Unknown, attempts: 1 },
    }} />)}
  </>;
}
