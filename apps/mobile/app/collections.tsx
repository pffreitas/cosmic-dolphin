import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type {
  Collection,
  BookmarkLibraryCounts,
} from "@cosmic-dolphin/api-client";
import {
  Button,
  layout,
  Notice,
  PageHeading,
  Screen,
  Sheet,
  SkeletonRows,
} from "@/components/ui/Signal";
import { MobileAPI } from "@/lib/mobile-api";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
export default function CollectionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [counts, setCounts] = useState<BookmarkLibraryCounts>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const [next, count] = await Promise.all([
        MobileAPI.collections(),
        MobileAPI.counts(),
      ]);
      setCollections(next);
      setCounts(count);
    } catch {
      setError("Your collections could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const navigate = (
    scope: "all" | "inbox" | "archive",
    title: string,
    collectionId?: string,
  ) =>
    router.push({
      pathname: "/(tabs)/library",
      params: { scope, name: title, collectionId: collectionId || "" },
    });
  const rows = [
    { id: "all", name: "All saves", count: counts?.all },
    { id: "inbox", name: "Inbox", count: counts?.inbox },
    { id: "archive", name: "Archive", count: counts?.archived },
  ];
  const row = (
    key: string,
    title: string,
    count: number | undefined,
    onPress: () => void,
    nested = false,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        layout.between,
        {
          paddingVertical: space.s4,
          paddingLeft: nested ? space.s5 : 0,
          borderBottomWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name="folder-outline" size={20} color={colors.fgSecondary} />
      <Text style={[textStyle("body"), { flex: 1, color: colors.fg }]}>
        {title}
      </Text>
      <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
        {count ?? "—"}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.fgTertiary} />
    </Pressable>
  );
  return (
    <Screen title="Library" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={layout.content}>
        <PageHeading
          title="Collections"
          subtitle="An editable home for your saves."
        />
        {error ? (
          <Notice message={error} error action="Retry" onAction={load} />
        ) : null}
        {loading ? (
          <SkeletonRows />
        ) : (
          <View>
            {rows.map((value) =>
              row(value.id, value.name, value.count, () =>
                navigate(value.id as "all" | "inbox" | "archive", value.name),
              ),
            )}
            {collections.map((collection) =>
              row(
                collection.id,
                collection.parentId
                  ? `${collections.find((parent) => parent.id === collection.parentId)?.name || "Collection"} / ${collection.name}`
                  : collection.name,
                counts?.collections.find(
                  (value) => value.collectionId === collection.id,
                )?.count,
                () => navigate("all", collection.name, collection.id),
                Boolean(collection.parentId),
              ),
            )}
          </View>
        )}
        <Button
          title="New collection"
          icon="add"
          onPress={() => {
            setError("");
            setAdding(true);
          }}
        />
        <Notice message="Cosmic suggests a collection for each save. When you move one, your choice stays." />
      </ScrollView>
      <Sheet
        title="New collection"
        visible={adding}
        onClose={() => {
          if (!busy) setAdding(false);
        }}
      >
        <TextInput
          accessibilityLabel="Collection name"
          value={name}
          onChangeText={setName}
          placeholder="A place for your ideas"
          placeholderTextColor={colors.fgTertiary}
          style={[
            layout.input,
            {
              color: colors.fg,
              backgroundColor: colors.bg,
              borderColor: colors.borderStrong,
            },
          ]}
          autoFocus
        />
        {error ? <Notice message={error} error /> : null}
        <Button
          title="Create collection"
          primary
          busy={busy}
          disabled={!name.trim()}
          onPress={async () => {
            setBusy(true);
            try {
              await MobileAPI.createCollection(name.trim());
              setAdding(false);
              setName("");
              await load();
            } catch {
              setError("The collection could not be created. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>
    </Screen>
  );
}
