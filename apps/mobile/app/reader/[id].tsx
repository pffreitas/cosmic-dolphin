import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Highlight } from "@cosmic-dolphin/api-client";
import { TopBarAction } from "@/components/TopBar";
import {
  Button,
  EmptyState,
  layout,
  Notice,
  PageHeading,
  Screen,
  Sheet,
  SkeletonRows,
} from "@/components/ui/Signal";
import { BookmarksAPI, type Bookmark } from "@/lib/api";
import { MobileAPI } from "@/lib/mobile-api";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useTheme } from "@/hooks/useTheme";
import { fontFamily, textStyle } from "@/constants/fonts";
import { space, type } from "@/constants/theme";
import {
  cacheBookmarksInBackground,
  getCachedBookmark,
} from "@/lib/bookmark-cache";
import { isAuthError } from "@/lib/api-errors";
function readableText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[#>]+\s*/gm, "")
    .replace(/[*_`]/g, "");
}
export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const preferences = usePreferences();
  const [bookmark, setBookmark] = useState<Bookmark>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [percent, setPercent] = useState(0);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [sheet, setSheet] = useState<
    "appearance" | "highlight" | "highlights"
  >();
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [readyToRecord, setReadyToRecord] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const restoreOffset = useRef(0);
  const restored = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<{
    id: string;
    userId: string;
    percent: number;
    offset: number;
  }>();
  const recordOwner = useRef(false);
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;
  const flush = () => {
    if (
      latest.current &&
      latest.current.userId === activeUser.current &&
      recordOwner.current
    ) {
      const value = latest.current;
      latest.current = undefined;
      void MobileAPI.saveProgress(value.id, value.percent, value.offset).catch(
        () => {
          setError("Reading progress could not be saved.");
        },
      );
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setBookmark(undefined);
    recordOwner.current = false;
    setSheet(undefined);
    setError("");
    setPercent(0);
    setHighlights([]);
    restoreOffset.current = 0;
    restored.current = false;
    setReadyToRecord(false);
    (async () => {
      let next: Bookmark | null;
      try {
        next = await BookmarksAPI.findById(id);
      } catch (err) {
        if (isAuthError(err) || !userId) throw err;
        next = await getCachedBookmark(userId, id);
        if (!next) throw err;
      }
      if (!next) throw Error("This save is no longer available.");
      if (!active) return;
      setBookmark(next);
      recordOwner.current = next.userId === userId;
      if (recordOwner.current) {
        const [progress, savedHighlights] = await Promise.allSettled([
          MobileAPI.progress(id),
          MobileAPI.highlights(id),
        ]);
        if (!active) return;
        if (progress.status === "fulfilled" && progress.value) {
          restoreOffset.current = progress.value.scrollOffset || 0;
          setPercent(progress.value.percent);
        }
        if (savedHighlights.status === "fulfilled")
          setHighlights(savedHighlights.value);
      }
    })()
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "The save could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const sub = AppState.addEventListener("change", (value) => {
      if (value !== "active") flushRef.current();
    });
    return () => {
      active = false;
      sub.remove();
      clearTimeout(timer.current);
      flushRef.current();
    };
  }, [id, userId, attempt]);
  const body = readableText(
    bookmark?.cosmicSummary || bookmark?.cosmicBriefSummary || "",
  );
  const size =
    preferences.readingSize === "larger"
      ? type.title1.fontSize
      : preferences.readingSize === "large"
        ? space.s5
        : type.title2.fontSize;
  const owner = bookmark?.userId === user?.id;
  return (
    <Screen
      title="Reading"
      onBack={() => router.back()}
      actions={
        <>
          <TopBarAction
            icon="text-outline"
            label="Reading appearance"
            onPress={() => setSheet("appearance")}
          />
          {owner ? (
            <TopBarAction
              icon="bookmarks-outline"
              label="Your highlights"
              onPress={() => setSheet("highlights")}
            />
          ) : null}
        </>
      }
    >
      <View
        accessibilityLabel={`${Math.round(percent)}% read`}
        style={{ height: 2, backgroundColor: colors.bgInset }}
      >
        <View
          style={{
            width: `${percent}%`,
            height: 2,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      {loading ? (
        <View style={layout.content}>
          <SkeletonRows />
        </View>
      ) : !bookmark ? (
        <View style={layout.content}>
          <EmptyState
            title="This save could not be opened"
            description={error}
            action="Try again"
            onAction={() => setAttempt((v) => v + 1)}
          />
        </View>
      ) : (
        <>
          <ScrollView
            ref={scroll}
            contentContainerStyle={layout.content}
            onContentSizeChange={() => {
              if (!restored.current) {
                restored.current = true;
                scroll.current?.scrollTo({
                  y: restoreOffset.current,
                  animated: false,
                });
                setReadyToRecord(true);
              }
            }}
            scrollEventThrottle={100}
            onScroll={(event) => {
              if (!readyToRecord) return;
              const { contentOffset, contentSize, layoutMeasurement } =
                event.nativeEvent;
              const available = contentSize.height - layoutMeasurement.height;
              const next =
                available > 0
                  ? Math.max(
                      0,
                      Math.min(100, (contentOffset.y / available) * 100),
                    )
                  : 0;
              setPercent(next);
              latest.current = {
                id,
                userId: user?.id || "",
                percent: next,
                offset: contentOffset.y,
              };
              clearTimeout(timer.current);
              timer.current = setTimeout(flush, 800);
            }}
          >
            <PageHeading
              title={bookmark.title || "Your save"}
              subtitle={
                bookmark.isPrivateLink
                  ? "Your private notes"
                  : "Full Cosmic brief"
              }
            />
            {error ? <Notice message={error} error /> : null}
            {body ? (
              <Text
                selectable
                style={{
                  fontFamily: fontFamily.serif,
                  fontSize: size,
                  lineHeight: size * 1.7,
                  color: colors.fg,
                }}
              >
                {body}
              </Text>
            ) : (
              <Notice message="Saved content is not available yet. You can still read the original." />
            )}
            <Button
              title="Open original article"
              icon="open-outline"
              onPress={() => {
                void Linking.openURL(bookmark.sourceUrl);
              }}
            />
            <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
              Source: {bookmark.sourceUrl}
            </Text>
          </ScrollView>
          <View
            style={[
              layout.row,
              {
                padding: space.s3,
                paddingBottom: Math.max(insets.bottom, space.s3),
                borderTopWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            {owner ? (
              <>
                <TopBarAction
                  icon="create-outline"
                  label="Highlight a passage"
                  onPress={() => {
                    setQuote("");
                    setNote("");
                    setSheet("highlight");
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Button
                    title={
                      bookmark.isRead || bookmark.readAt
                        ? "Mark unread"
                        : "Mark as read"
                    }
                    primary
                    busy={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        const updated =
                          bookmark.isRead || bookmark.readAt
                            ? await BookmarksAPI.markUnread(bookmark.id)
                            : await BookmarksAPI.markRead(bookmark.id);
                        setBookmark(updated);
                        cacheBookmarksInBackground(user?.id, [updated]);
                      } catch {
                        Alert.alert(
                          "Could not update read status",
                          "Check your connection and try again.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </View>
              </>
            ) : (
              <Button
                title="Save to your Library"
                primary
                busy={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const saved = await MobileAPI.saveRecommendation(
                      bookmark.id,
                    );
                    router.replace(`/reader/${saved.id}`);
                  } catch {
                    Alert.alert("Link was not saved", "Try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </View>
        </>
      )}
      <Sheet
        title={
          sheet === "appearance"
            ? "Reading appearance"
            : sheet === "highlight"
              ? "Highlight a passage"
              : "Your highlights"
        }
        visible={Boolean(sheet)}
        onClose={() => setSheet(undefined)}
      >
        {sheet === "appearance" ? (
          <>
            {(["default", "large", "larger"] as const).map((value) => (
              <Button
                key={value}
                title={value[0].toUpperCase() + value.slice(1)}
                icon={
                  preferences.readingSize === value ? "checkmark" : undefined
                }
                onPress={() => preferences.update({ readingSize: value })}
              />
            ))}
            <Button title="Done" primary onPress={() => setSheet(undefined)} />
          </>
        ) : sheet === "highlight" ? (
          <>
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
              Select and copy a passage, then paste it here. Your highlight is
              private.
            </Text>
            <TextInput
              accessibilityLabel="Passage to highlight"
              multiline
              value={quote}
              onChangeText={setQuote}
              style={[
                layout.input,
                { color: colors.fg, borderColor: colors.borderStrong },
              ]}
            />
            <TextInput
              accessibilityLabel="Private note"
              placeholder="A note to return to (optional)"
              placeholderTextColor={colors.fgTertiary}
              multiline
              value={note}
              onChangeText={setNote}
              style={[
                layout.input,
                { color: colors.fg, borderColor: colors.borderStrong },
              ]}
            />
            <Button
              title="Save highlight"
              primary
              busy={busy}
              disabled={!quote.trim()}
              onPress={async () => {
                if (!body.includes(quote.trim())) {
                  Alert.alert(
                    "Passage not found",
                    "Choose a passage from the saved content.",
                  );
                  return;
                }
                setBusy(true);
                try {
                  const created = await MobileAPI.highlight(
                    id,
                    quote.trim(),
                    note.trim() || undefined,
                  );
                  setHighlights((previous) => [...previous, created]);
                  setSheet(undefined);
                } catch {
                  Alert.alert("Highlight was not saved", "Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : highlights.length ? (
          highlights.map((highlight) => (
            <View
              key={highlight.id}
              style={[
                layout.panel,
                { backgroundColor: colors.hlBg, borderColor: colors.hlLine },
              ]}
            >
              <Text
                selectable
                style={[textStyle("quote"), { color: colors.fg }]}
              >
                {highlight.quote}
              </Text>
              {highlight.note ? (
                <Text
                  style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
                >
                  {highlight.note}
                </Text>
              ) : null}
              <Button
                title="Remove highlight"
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await MobileAPI.removeHighlight(highlight.id);
                    setHighlights((previous) =>
                      previous.filter((value) => value.id !== highlight.id),
                    );
                  } catch {
                    Alert.alert(
                      "Could not remove highlight",
                      "Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>
          ))
        ) : (
          <EmptyState
            title="Keep what stays with you"
            description="Select a passage in the reader to start your private highlights."
          />
        )}
      </Sheet>
    </Screen>
  );
}
