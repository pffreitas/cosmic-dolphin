import React from "react";
import { Text, View } from "react-native";
import type { BookmarkProcessingEvent } from "@cosmic-dolphin/api-client";
import { textStyle } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";
const PHASES = [
  ["fetch", "Fetching page", "Fetched page"],
  ["extract", "Extracting content", "Extracted content"],
  ["summarise", "Summarising", "Summarised"],
  ["tag", "Tagging", "Tagged"],
  ["file", "Filing into a topic", "Filed"],
] as const;

/** Shows only statuses reported by the pipeline; queued phases have no fake progress. */
export function PendingPhases({ events, privateLink = false }: { events: BookmarkProcessingEvent[]; privateLink?: boolean }) {
  const { colors } = useTheme();
  return <View accessibilityLabel="Processing phases" accessibilityLiveRegion="polite">
    {PHASES.filter(([phase]) => !privateLink || phase !== "fetch").map(([phase, running, completed]) => {
      const event = events.filter(value => value.kind === "phase" && value.phase === phase).sort((a, b) => b.sequence - a.sequence)[0];
      return <Text key={phase} style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{event?.status === "completed" ? completed : event?.status === "running" ? `${running}…` : running}</Text>;
    })}
  </View>;
}
