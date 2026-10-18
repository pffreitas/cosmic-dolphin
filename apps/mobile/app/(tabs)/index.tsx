import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { FeedScope } from "@cosmic-dolphin/api-client";
import { CaptureStatus } from "@/components/CaptureStatus";
import { TopBarAction } from "@/components/TopBar";
import { Recommendation } from "@/components/Recommendation";
import {
  Button,
  Chip,
  EmptyState,
  layout,
  Notice,
  PageHeading,
  Screen,
  Segments,
  Sheet,
  SkeletonRows,
} from "@/components/ui/Signal";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeFeed } from "@/hooks/useHomeFeed";
import { buildEditions, type Edition } from "@/lib/home-editions";
import { rememberEditions } from "@/lib/edition-store";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const preferences = usePreferences();
  const [scope, setScope] = useState<FeedScope>("for_you");
  const feed = useHomeFeed(scope);
  const [topic, setTopic] = useState("All topics");
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [options, setOptions] = useState<Edition>();
  const [undoTopic, setUndoTopic] = useState<string>();
  const editions = useMemo(
    () => buildEditions(feed.items, preferences.interests),
    [feed.items, preferences.interests],
  );
  const topics = [...new Set(editions.map((edition) => edition.topic))];
  useEffect(() => {
    if (user) rememberEditions(user.id, editions);
  }, [editions, user]);
  useEffect(() => {
    if (
      !feed.loading &&
      !feed.refreshing &&
      topic !== "All topics" &&
      !editions.some((edition) => edition.topic === topic)
    )
      setTopic("All topics");
  }, [editions, feed.loading, feed.refreshing, topic]);
  const visible = editions.filter(
    (edition) =>
      !preferences.hiddenTopics.includes(edition.topic) &&
      (topic === "All topics" || topic === edition.topic),
  );
  const openEdition = (edition: Edition) =>
    router.push({ pathname: "/topic", params: { id: edition.id } });
  const toggleInterest = (value: string) =>
    preferences.update({
      interests: preferences.interests.includes(value)
        ? preferences.interests.filter((t) => t !== value)
        : [...preferences.interests, value],
    });
  return (
    <Screen
      title="Cosmic Dolphin"
      actions={
        <>
          <TopBarAction
            icon="search-outline"
            label="Search"
            onPress={() => router.push("/search")}
          />
          <TopBarAction
            icon="person-outline"
            label="Your profile"
            onPress={() => router.push("/(tabs)/profile")}
          />
        </>
      }
    >
      <FlatList
        data={feed.loading ? [] : visible}
        keyExtractor={(edition) => edition.id}
        contentContainerStyle={layout.content}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing && !feed.loading}
            onRefresh={feed.refresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: space.s4 }}>
            <CaptureStatus
              loadedIds={feed.items.flatMap((item) =>
                item.bookmark ? [item.bookmark.id] : [],
              )}
            />
            <PageHeading
              title="Worth your time."
              subtitle="A personal feed of ideas worth exploring."
            />
            <View style={layout.row}>
              <View style={{ flex: 1 }}>
                <Segments
                  options={[
                    { label: "For you", value: "for_you" },
                    { label: "Following", value: "following" },
                  ]}
                  value={scope}
                  onChange={(value) => {
                    setTopic("All topics");
                    setScope(value);
                  }}
                />
              </View>
              <TopBarAction
                icon="options-outline"
                label="Tune your interests"
                onPress={() => setInterestsOpen(true)}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.s2 }}
            >
              {["All topics", ...topics].map((value) => (
                <Chip
                  key={value}
                  label={value}
                  selected={topic === value}
                  onPress={() => setTopic(value)}
                />
              ))}
            </ScrollView>
            {feed.error ? (
              <Notice
                message={feed.error}
                error
                action="Retry"
                onAction={feed.refresh}
              />
            ) : null}
            {undoTopic ? (
              <Notice
                message={`Showing less of ${undoTopic}`}
                action="Undo"
                onAction={() => {
                  preferences.update({
                    hiddenTopics: preferences.hiddenTopics.filter(
                      (t) => t !== undoTopic,
                    ),
                  });
                  setUndoTopic(undefined);
                }}
              />
            ) : null}
            {feed.loading ? <SkeletonRows /> : null}
          </View>
        }
        renderItem={({ item: edition }) => (
          <View style={styles.edition}>
            <View style={layout.between}>
              <Text
                accessibilityRole="header"
                style={[textStyle("title1"), { color: colors.fg, flex: 1 }]}
              >
                {edition.title}
              </Text>
              <TopBarAction
                icon="ellipsis-horizontal"
                label={`Options for ${edition.title}`}
                onPress={() => setOptions(edition)}
              />
            </View>
            <Text
              style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
              numberOfLines={3}
            >
              {edition.description}
            </Text>
            <View
              style={[
                styles.links,
                { borderColor: colors.border, backgroundColor: colors.bgPanel },
              ]}
            >
              {edition.digest
                ? edition.digest.sources.slice(0, 2).map((source) => (
                    <Pressable
                      key={source.bookmarkId}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push(`/bookmark/${source.bookmarkId}`)
                      }
                      style={[styles.source, { borderColor: colors.border }]}
                    >
                      <Text
                        style={[
                          textStyle("meta"),
                          { color: colors.fgTertiary },
                        ]}
                      >
                        {source.domain}
                      </Text>
                      <Text style={[textStyle("title3"), { color: colors.fg }]}>
                        {source.title}
                      </Text>
                    </Pressable>
                  ))
                : edition.bookmarks
                    .slice(0, 2)
                    .map((bookmark, index) => (
                      <Recommendation
                        key={bookmark.id}
                        bookmark={bookmark}
                        compact={index > 0}
                      />
                    ))}
              <Button
                title={`Explore ${edition.digest?.sources.length ?? edition.bookmarks.length} links`}
                icon="arrow-forward"
                onPress={() => openEdition(edition)}
                style={{ borderWidth: 0 }}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          !feed.loading ? (
            <EmptyState
              title={
                feed.error
                  ? "Your reading lists will be back"
                  : scope === "following"
                    ? "Good reading travels through people"
                    : "A fresh starting point"
              }
              description={
                feed.error
                  ? "Try loading your feed again."
                  : preferences.hiddenTopics.length
                    ? "Adjust your topics to bring more ideas into view."
                    : "Save a link to start shaping your feed. Public discoveries and connected reading lists will appear as they become available."
              }
              action={
                preferences.hiddenTopics.length
                  ? "Show all topics"
                  : "Save a link"
              }
              onAction={() =>
                preferences.hiddenTopics.length
                  ? preferences.update({ hiddenTopics: [] })
                  : router.push("/save")
              }
            />
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: space.s4 }}>
            {feed.hasMore ? (
              <Button
                title="More reading lists"
                busy={feed.more}
                onPress={feed.loadMore}
              />
            ) : null}
            {feed.resume.length ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={[textStyle("bodySm"), { color: colors.fg }]}
                >
                  Pick up where you left off
                </Text>
                {feed.resume.map((item) => (
                  <Pressable
                    key={item.bookmark.id}
                    accessibilityRole="button"
                    style={[
                      layout.panel,
                      {
                        backgroundColor: colors.bgSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => router.push(`/reader/${item.bookmark.id}`)}
                  >
                    <Text style={[textStyle("title3"), { color: colors.fg }]}>
                      {item.bookmark.title}
                    </Text>
                    <View
                      style={{
                        height: 2,
                        backgroundColor: colors.borderStrong,
                      }}
                    >
                      <View
                        style={{
                          height: 2,
                          width: `${Math.max(0, Math.min(100, item.progress.percent))}%`,
                          backgroundColor: colors.accent,
                        }}
                      />
                    </View>
                    <Text
                      style={[textStyle("meta"), { color: colors.fgTertiary }]}
                    >
                      {Math.round(item.progress.percent)}% read
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : null}
          </View>
        }
      />
      <Sheet
        title="Shape your Home"
        visible={interestsOpen}
        onClose={() => setInterestsOpen(false)}
      >
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
          Choose topics to bring them higher in your feed. New interests emerge
          from what you save and read.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s2 }}>
          {[...new Set(["AI", "Self improvement", "Design", ...topics])].map(
            (value) => (
              <Chip
                key={value}
                label={value}
                selected={preferences.interests.includes(value)}
                onPress={() => toggleInterest(value)}
              />
            ),
          )}
        </View>
        {preferences.hiddenTopics.length ? (
          <Button
            title="Restore hidden topics"
            onPress={() => preferences.update({ hiddenTopics: [] })}
          />
        ) : null}
        <Button
          title="Done"
          primary
          onPress={() => {
            setTopic("All topics");
            setInterestsOpen(false);
          }}
        />
      </Sheet>
      <Sheet
        title={options?.title ?? "Topic options"}
        visible={Boolean(options)}
        onClose={() => setOptions(undefined)}
      >
        <Button
          title="Show less of this topic"
          onPress={() => {
            if (options) {
              preferences.update({
                hiddenTopics: [...preferences.hiddenTopics, options.topic],
              });
              setUndoTopic(options.topic);
              setTopic("All topics");
            }
            setOptions(undefined);
          }}
        />
        <Button
          title="Tune your interests"
          onPress={() => {
            setOptions(undefined);
            setInterestsOpen(true);
          }}
        />
      </Sheet>
    </Screen>
  );
}
const styles = StyleSheet.create({
  edition: { marginTop: space.s5, gap: space.s3 },
  links: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  source: {
    minHeight: 44,
    paddingVertical: space.s4,
    gap: space.s2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
