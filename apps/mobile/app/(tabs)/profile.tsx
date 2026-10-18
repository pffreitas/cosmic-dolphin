import React, { useCallback, useState } from "react";
import { Image, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { Profile } from "@cosmic-dolphin/api-client";
import { BookmarkCard } from "@/components/BookmarkCard";
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
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { MobileAPI, nativeBookmark } from "@/lib/mobile-api";
import type { Bookmark } from "@/lib/api";
import { radius, space } from "@/constants/theme";
import { textStyle } from "@/constants/fonts";
export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>();
  const [saves, setSaves] = useState<Bookmark[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const next = await MobileAPI.profile();
      setProfile(next);
      setName(next.name || "");
      setHandle(next.handle || "");
      if (next.handle) {
        const page = await MobileAPI.publicSaves(next.handle);
        setSaves(page.bookmarks.map(nativeBookmark));
        setCursor(page.nextCursor);
      }
    } catch {
      setError("Your profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const displayName =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Your profile";
  return (
    <Screen
      title="You"
      actions={
        <TopBarAction
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push("/settings")}
        />
      }
    >
      <ScrollView contentContainerStyle={{ paddingBottom: space.s7 }}>
        <View style={layout.content}>
          {loading ? (
            <SkeletonRows />
          ) : (
            <>
              <View style={{ alignItems: "center", gap: space.s3 }}>
                {profile?.pictureUrl ? (
                  <Image
                    source={{ uri: profile.pictureUrl }}
                    style={{
                      width: space.s8,
                      height: space.s8,
                      borderRadius: radius.pill,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: space.s8,
                      height: space.s8,
                      borderRadius: radius.pill,
                      backgroundColor: colors.id5Bg,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text style={[textStyle("title1"), { color: colors.id5 }]}>
                      {displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <PageHeading
                  title={displayName}
                  subtitle={
                    profile?.handle ? `@${profile.handle}` : user?.email
                  }
                />
              </View>
              <Button title="Edit profile" onPress={() => setEditing(true)} />
              <Button
                title="Your private library"
                icon="lock-closed-outline"
                onPress={() => router.push("/(tabs)/library")}
              />
              <Notice message="Only the saves you explicitly publish appear on your profile. Your library and highlights stay private." />
              <Text
                accessibilityRole="header"
                style={[textStyle("title2"), { color: colors.fg }]}
              >
                Public saves
              </Text>
            </>
          )}
          {error ? (
            <Notice message={error} error action="Retry" onAction={load} />
          ) : null}
        </View>
        {saves.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onPress={(value) => router.push(`/bookmark/${value.id}`)}
          />
        ))}
        {!loading && !saves.length && !error ? (
          <EmptyState
            title="Share something worth reading"
            description="Your public saves will appear here when you choose to share them."
          />
        ) : null}
        {cursor && profile?.handle ? (
          <Button
            title="More public saves"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const page = await MobileAPI.publicSaves(
                  profile.handle!,
                  cursor,
                );
                setSaves((previous) => [
                  ...previous,
                  ...page.bookmarks.map(nativeBookmark),
                ]);
                setCursor(page.nextCursor);
              } catch {
                setError("More saves could not be loaded.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </ScrollView>
      <Sheet
        title="Edit profile"
        visible={editing}
        onClose={() => {
          if (!busy) setEditing(false);
        }}
      >
        <Text style={[textStyle("bodySm"), { color: colors.fg }]}>
          Display name
        </Text>
        <TextInput
          accessibilityLabel="Display name"
          value={name}
          onChangeText={setName}
          style={[
            layout.input,
            { color: colors.fg, borderColor: colors.borderStrong },
          ]}
        />
        <Text style={[textStyle("bodySm"), { color: colors.fg }]}>Handle</Text>
        <TextInput
          accessibilityLabel="Handle"
          autoCapitalize="none"
          autoCorrect={false}
          value={handle}
          onChangeText={setHandle}
          style={[
            layout.input,
            { color: colors.fg, borderColor: colors.borderStrong },
          ]}
        />
        {error ? <Notice message={error} error /> : null}
        <Button
          title="Save profile"
          primary
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const next = await MobileAPI.updateProfile(
                name.trim(),
                handle.trim() !== profile?.handle ? handle.trim() : undefined,
              );
              setProfile(next);
              setEditing(false);
              await load();
            } catch {
              setError(
                "Your profile could not be updated. Check the name and handle, then try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>
    </Screen>
  );
}
