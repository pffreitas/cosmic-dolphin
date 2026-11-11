import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { BookmarkProcessingEvent } from "@cosmic-dolphin/api-client";
import { useCaptures, type Capture } from "@/contexts/CaptureContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { MobileAPI } from "@/lib/mobile-api";
import { Button, layout } from "./ui/Signal";
const PHASES = [
  ["fetch", "Fetching page", "Fetched page"],
  ["extract", "Extracting content", "Extracted content"],
  ["summarise", "Summarising", "Summarised"],
  ["tag", "Tagging", "Tagged"],
  ["file", "Filing into a topic", "Filed"],
] as const;
function CaptureRow({ capture }: { capture: Capture }) {
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
        updateBookmark(capture.id, timeline.bookmark);
        if (timeline.bookmark.processingStatus === "processing") timer = setTimeout(load, Math.max(250, timeline.pollAfterMs));
      } catch { if (!controller.signal.aborted) timer = setTimeout(load, 5000); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, processing, capture.id, capture.entry.userId, updateBookmark]);
  const failed = capture.status === "failed";
  const queued = capture.status === "queued";
  const path = capture.bookmark?.collectionPath?.map(part => part.name).join(" › ");
  return <View style={[layout.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]} accessibilityLiveRegion="polite" accessibilityLabel={failed ? "Unsent save" : processing ? "Saving now" : undefined}>
    <Text style={[textStyle("title1"), { color: colors.fg }]}>{capture.bookmark?.title || capture.entry.title || capture.entry.url}</Text>
    <Text style={[textStyle("bodySm"), { color: failed ? colors.danger : colors.fgSecondary }]}>
      {failed ? "Couldn't save this link" : queued ? "Saved on this phone. Cosmic reads it when you open the app." : capture.status === "saving" ? "Saving…" : capture.alreadySaved ? "Already in your Library" : processing ? "Cosmic is reading it" : "Saved privately to your Library"}
    </Text>
    {processing ? <View accessibilityLabel="Processing phases">
      {PHASES.filter(([phase]) => !capture.entry.isPrivateLink || phase !== "fetch").map(([phase, running, completed]) => {
        const event = events.filter(value => value.kind === "phase" && value.phase === phase).sort((a, b) => b.sequence - a.sequence)[0];
        return <Text key={phase} style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{event?.status === "completed" ? completed : event?.status === "running" ? `${running}…` : running}</Text>;
      })}
    </View> : null}
    {path ? <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>{path}</Text> : null}
    {failed ? <>
      {capture.entry.failure !== "rejected" ? <Button title="Retry" onPress={() => retry(capture.id)} /> : null}
      <Button title="Remove" onPress={() => remove(capture.id)} />
    </> : capture.bookmark ? <Button title="Open save" onPress={() => router.push(`/bookmark/${capture.bookmark!.id}`)} /> : null}
  </View>;
}
export function CaptureStatus({ loadedIds = [] }: { loadedIds?: string[] }) {
  const { captures, acknowledge, revision } = useCaptures();
  const ids = loadedIds.join("\0");
  useEffect(() => { acknowledge(ids.split("\0")); }, [ids, acknowledge, revision]);
  return <>
    {captures.filter(capture => !capture.bookmark || capture.bookmark.processingStatus === "processing" || !loadedIds.includes(capture.bookmark.id)).map(capture => <CaptureRow key={capture.id} capture={capture} />)}
  </>;
}
