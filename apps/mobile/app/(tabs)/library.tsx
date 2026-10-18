import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { Collection } from "@cosmic-dolphin/api-client";
import { BookmarkCard } from "@/components/BookmarkCard";
import { CaptureStatus } from "@/components/CaptureStatus";
import { TopBarAction } from "@/components/TopBar";
import {
  Button,
  EmptyState,
  layout,
  Notice,
  PageHeading,
  Screen,
  Segments,
  Sheet,
  SkeletonRows,
} from "@/components/ui/Signal";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useCaptures } from "@/contexts/CaptureContext";
import { Bookmark } from "@/lib/api";
import { MobileAPI } from "@/lib/mobile-api";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    collectionId?: string;
    name?: string;
    scope?: "all" | "inbox" | "archive";
  }>();
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [sorting, setSorting] = useState(false);
  const [selected, setSelected] = useState<Bookmark>();
  const [moving, setMoving] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionError, setCollectionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Bookmark>();
  const { revision } = useCaptures();
  const data = useBookmarks({
    mode: "library",
    readStatus: filter,
    collectionId: params.collectionId,
    scope: params.scope || "all",
    sort,
  });
  const refreshRef = useRef(data.refresh);
  refreshRef.current = data.refresh;
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refreshRef.current();
      focused.current = true;
    }, []),
  );
  useEffect(() => {
    if (revision) void refreshRef.current();
  }, [revision]);
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      setSelected(undefined);
      setMoving(false);
      await data.refresh();
    } catch {
      Alert.alert(
        "Change was not saved",
        "Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const loadCollections = async () => {
    setCollectionError(false);
    try {
      setCollections(await MobileAPI.collections());
    } catch {
      setCollectionError(true);
    }
  };
  return (
    <Screen
      title="Library"
      actions={
        <TopBarAction
          icon="search-outline"
          label="Search Library"
          onPress={() => router.push("/search")}
        />
      }
    >
      <FlatList
        data={data.bookmarks}
        keyExtractor={(bookmark) => bookmark.id}
        refreshControl={
          <RefreshControl
            refreshing={data.isLoading && data.bookmarks.length > 0}
            onRefresh={data.refresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={() => {
          if (data.hasMore) void data.loadMore();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={layout.content}>
            <PageHeading
              title={
                params.name ||
                (params.scope === "archive"
                  ? "Archive"
                  : params.scope === "inbox"
                    ? "Inbox"
                    : "All saves")
              }
              subtitle="Your private archive."
            />
            <View style={layout.between}>
              <Button
                title="Collections"
                icon="folder-outline"
                onPress={() => router.push("/collections")}
              />
              <Button
                title="Sort"
                icon="options-outline"
                onPress={() => setSorting(true)}
              />
            </View>
            <Segments
              options={[
                { label: "All", value: "all" },
                { label: "Unread", value: "unread" },
                { label: "Read", value: "read" },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
              {sort === "newest" ? "Newest first" : "Oldest first"}
            </Text>
            <CaptureStatus
              loadedIds={data.bookmarks.map((bookmark) => bookmark.id)}
            />
            {data.isOffline ? (
              <Notice message="You’re offline. Previously saved links are shown." />
            ) : null}
            {data.error ? (
              <Notice
                message={data.error}
                error
                action="Retry"
                onAction={data.refresh}
              />
            ) : null}
            {undo ? (
              <Notice
                message={undo.isArchived ? "Save restored" : "Save archived"}
                action="Undo"
                onAction={() => {
                  void run(() =>
                    MobileAPI.archive(undo.id, Boolean(undo.isArchived)),
                  );
                  setUndo(undefined);
                }}
              />
            ) : null}
            {data.isLoading && !data.bookmarks.length ? <SkeletonRows /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <BookmarkCard
            bookmark={item}
            onPress={(bookmark) => router.push(`/bookmark/${bookmark.id}`)}
            showReadStatus
            onActions={setSelected}
          />
        )}
        ListEmptyComponent={
          !data.isLoading && !data.error ? (
            <EmptyState
              title={
                filter === "read"
                  ? "A little reading goes a long way"
                  : params.collectionId
                    ? "A place for your next good read"
                    : "Your library starts here"
              }
              description={
                filter === "read"
                  ? "Mark a save as read and return to it here."
                  : "Save a link or move one into this collection."
              }
              action="Save a link"
              onAction={() => router.push("/save")}
            />
          ) : null
        }
        ListFooterComponent={
          data.isLoadingMore ? (
            <View style={layout.content}>
              <SkeletonRows />
            </View>
          ) : (
            <View style={{ height: space.s6 }} />
          )
        }
      />
      <Sheet
        title="Sort saves"
        visible={sorting}
        onClose={() => setSorting(false)}
      >
        {(["newest", "oldest"] as const).map((value) => (
          <Button
            key={value}
            title={value === "newest" ? "Newest first" : "Oldest first"}
            icon={sort === value ? "checkmark" : undefined}
            onPress={() => {
              setSort(value);
              setSorting(false);
            }}
          />
        ))}
      </Sheet>
      <Sheet
        title={moving ? "Move to collection" : "Save actions"}
        visible={Boolean(selected)}
        onClose={() => {
          if (!busy) {
            setSelected(undefined);
            setMoving(false);
          }
        }}
      >
        {moving ? (
          <>
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
              Your placement stays. Cosmic won’t move this save again.
            </Text>
            {collectionError ? (
              <Notice
                message="Collections could not be loaded."
                error
                action="Retry"
                onAction={loadCollections}
              />
            ) : null}
            <Button
              title="Inbox"
              disabled={busy}
              onPress={() => {
                if (selected) void run(() => MobileAPI.refile(selected.id));
              }}
            />
            {collections.map((collection) => (
              <Button
                key={collection.id}
                title={collection.name}
                disabled={busy}
                onPress={() => {
                  if (selected)
                    void run(() =>
                      MobileAPI.refile(selected.id, collection.id),
                    );
                }}
              />
            ))}
          </>
        ) : (
          <>
            <Button
              title="Move to collection"
              disabled={busy}
              onPress={() => {
                setMoving(true);
                void loadCollections();
              }}
            />
            <Button
              title={
                selected?.isRead || selected?.readAt
                  ? "Mark unread"
                  : "Mark as read"
              }
              busy={busy}
              onPress={() => {
                if (selected) void run(() => data.toggleRead(selected));
              }}
            />
            <Button
              title={selected?.isArchived ? "Restore save" : "Archive save"}
              disabled={busy}
              onPress={() => {
                if (selected) {
                  const bookmark = selected;
                  void run(async () => {
                    await MobileAPI.archive(bookmark.id, !bookmark.isArchived);
                    setUndo(bookmark);
                  });
                }
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
