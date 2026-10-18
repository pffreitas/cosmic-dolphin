import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCaptures } from "@/contexts/CaptureContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { Button, layout } from "./ui/Signal";
export function CaptureStatus({ loadedIds = [] }: { loadedIds?: string[] }) {
  const { captures, retry, acknowledge, revision } = useCaptures();
  const ids = loadedIds.join("\0");
  useEffect(() => {
    acknowledge(ids.split("\0"));
  }, [ids, acknowledge, revision]);
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <>
      {captures
        .filter(
          (capture) =>
            !capture.bookmark || !loadedIds.includes(capture.bookmark.id),
        )
        .map((capture) => (
          <View
            key={capture.id}
            style={[
              layout.panel,
              { backgroundColor: colors.bgSubtle, borderColor: colors.border },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[textStyle("title3"), { color: colors.fg }]}>
              {capture.bookmark?.title ||
                capture.params.title ||
                capture.params.source_url}
            </Text>
            <Text
              style={[
                textStyle("bodySm"),
                {
                  color:
                    capture.status === "failed"
                      ? colors.danger
                      : colors.fgSecondary,
                },
              ]}
            >
              {capture.status === "failed"
                ? "Your link could not be saved. It is kept here while you retry."
                : capture.status === "saving"
                  ? "Saving privately to Inbox…"
                  : capture.bookmark?.processingStatus === "processing"
                    ? "Saved · Cosmic is reading it…"
                    : "Saved privately to your Library"}
            </Text>
            {capture.status === "failed" ? (
              <Button title="Retry save" onPress={() => retry(capture.id)} />
            ) : capture.bookmark ? (
              <Button
                title="Open save"
                onPress={() => router.push(`/bookmark/${capture.bookmark!.id}`)}
              />
            ) : null}
          </View>
        ))}
    </>
  );
}
