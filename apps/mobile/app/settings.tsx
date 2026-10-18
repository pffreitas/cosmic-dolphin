import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Chip,
  layout,
  Notice,
  PageHeading,
  Screen,
} from "@/components/ui/Signal";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
export default function SettingsScreen() {
  const router = useRouter();
  const preferences = usePreferences();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  return (
    <Screen title="Settings" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={layout.content}>
        <PageHeading
          title="Make yourself comfortable."
          subtitle="Your reading preferences, kept on this device."
        />
        <Text style={[textStyle("body"), { color: colors.fg }]}>
          Appearance
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s2 }}>
          {(["system", "light", "dark"] as const).map((value) => (
            <Chip
              key={value}
              label={value[0].toUpperCase() + value.slice(1)}
              selected={preferences.appearance === value}
              onPress={() => preferences.update({ appearance: value })}
            />
          ))}
        </View>
        <Text style={[textStyle("body"), { color: colors.fg }]}>
          Reading text size
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s2 }}>
          {(["default", "large", "larger"] as const).map((value) => (
            <Chip
              key={value}
              label={value[0].toUpperCase() + value.slice(1)}
              selected={preferences.readingSize === value}
              onPress={() => preferences.update({ readingSize: value })}
            />
          ))}
        </View>
        <View
          style={[
            layout.panel,
            { borderColor: colors.border, backgroundColor: colors.bgSubtle },
          ]}
        >
          <Text
            style={[
              textStyle("title2"),
              {
                color: colors.fg,
                fontSize:
                  preferences.readingSize === "larger"
                    ? 29
                    : preferences.readingSize === "large"
                      ? 24
                      : 20,
              },
            ]}
          >
            Give the good things the time they need.
          </Text>
        </View>
        <Text style={[textStyle("body"), { color: colors.fg }]}>
          Your privacy
        </Text>
        <Notice message="New saves are private by default. A public link is created only when you choose to share a save. Highlights remain private." />
        <Button
          title="Restore hidden Home topics"
          onPress={() => preferences.update({ hiddenTopics: [] })}
        />
        <Button
          title="Sign out"
          onPress={() =>
            Alert.alert(
              "Sign out?",
              "Your library will be here when you return.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: () => {
                    void signOut();
                  },
                },
              ],
            )
          }
        />
      </ScrollView>
    </Screen>
  );
}
