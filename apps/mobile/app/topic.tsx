import React, { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Screen,
  PageHeading,
  layout,
  EmptyState,
  SkeletonRows,
  Button,
} from "@/components/ui/Signal";
import { Recommendation } from "@/components/Recommendation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { MobileAPI } from "@/lib/mobile-api";
import { buildEditions, type Edition } from "@/lib/home-editions";
import { recalledEdition } from "@/lib/edition-store";
export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const { colors } = useTheme();
  const [edition, setEdition] = useState<Edition>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setEdition(undefined);
    setFailed(false);
    const remembered = userId && recalledEdition(userId, id);
    if (remembered) {
      setEdition(remembered);
      setLoading(false);
      return;
    }
    (async () => {
      if (id?.startsWith("digest:")) {
        const digest = await MobileAPI.digest(id.slice(7));
        return {
          id,
          title: digest.title,
          topic: "Across your saves",
          description: digest.summary,
          bookmarks: [],
          digest,
        };
      }
      const [feed, explore] = await Promise.all([
        MobileAPI.feed("for_you"),
        MobileAPI.explore(),
      ]);
      return buildEditions([...feed.items, ...explore.items]).find(
        (value) => value.id === id,
      );
    })()
      .then((value) => {
        if (active) setEdition(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, userId, attempt]);
  return (
    <Screen title="For you" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={layout.content}>
        {loading ? (
          <SkeletonRows />
        ) : !edition ? (
          <EmptyState
            title={
              failed
                ? "This reading list could not be loaded"
                : "This reading list has changed"
            }
            description="Return to Home for your latest collections."
            action={failed ? "Try again" : "Go to Home"}
            onAction={() =>
              failed ? setAttempt((v) => v + 1) : router.replace("/(tabs)")
            }
          />
        ) : (
          <>
            <PageHeading title={edition.title} subtitle={edition.description} />
            {edition.digest ? (
              <>
                <Text
                  style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
                >
                  The connection
                </Text>
                {edition.digest.keyPoints.map((point, i) => (
                  <Text
                    key={i}
                    style={[textStyle("body"), { color: colors.fg }]}
                  >
                    {point.term ? `${point.term} ` : ""}
                    {point.text}
                  </Text>
                ))}
                {edition.digest.sources.map((source) => (
                  <Button
                    key={source.bookmarkId}
                    title={`${source.title} · ${source.domain}`}
                    onPress={() =>
                      router.push(`/bookmark/${source.bookmarkId}`)
                    }
                  />
                ))}
                <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
                  Sources:{" "}
                  {edition.digest.sources
                    .map((source) => source.domain)
                    .join(" · ")}
                </Text>
              </>
            ) : (
              edition.bookmarks.map((bookmark) => (
                <Recommendation key={bookmark.id} bookmark={bookmark} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
