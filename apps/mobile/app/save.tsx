import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  layout,
  Notice,
  PageHeading,
  Screen,
} from "@/components/ui/Signal";
import { useTheme } from "@/hooks/useTheme";
import { useCaptures } from "@/contexts/CaptureContext";
import { textStyle } from "@/constants/fonts";
export default function SaveScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { save } = useCaptures();
  const [url, setUrl] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    try {
      const parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw Error();
    } catch {
      setError("Enter a complete http or https link.");
      return;
    }
    if (isPrivate && (!title.trim() || !note.trim())) {
      setError(
        "Add a title and a brief note so this private link is findable later.",
      );
      return;
    }
    save({
      source_url: url.trim(),
      ...(isPrivate
        ? {
            is_private_link: true,
            title: title.trim(),
            description: note.trim(),
          }
        : {}),
    });
    router.replace("/(tabs)/library");
  };
  const input = [
    layout.input,
    {
      backgroundColor: colors.bgPanel,
      color: colors.fg,
      borderColor: colors.borderStrong,
    },
  ];
  return (
    <Screen title="Save a link" onBack={() => router.back()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={layout.content}
          keyboardShouldPersistTaps="handled"
        >
          <PageHeading
            title="Keep something worthwhile."
            subtitle="Save the link now. Cosmic can read it while you do something else."
          />
          <Text style={[textStyle("bodySm"), { color: colors.fg }]}>Link</Text>
          <TextInput
            accessibilityLabel="Link"
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            placeholderTextColor={colors.fgTertiary}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={input}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!isPrivate) submit();
            }}
          />
          <Text style={[textStyle("bodySm"), { color: colors.fg }]}>
            Page behind a login?
          </Text>
          <Switch
            accessibilityLabel="Page behind a login"
            value={isPrivate}
            onValueChange={setPrivate}
            trackColor={{ false: colors.borderStrong, true: colors.accent }}
          />
          {isPrivate ? (
            <>
              <Text
                style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
              >
                Cosmic cannot fetch a page behind a login. Keep your own title
                and note instead.
              </Text>
              <TextInput
                accessibilityLabel="Your title"
                placeholder="Your title"
                placeholderTextColor={colors.fgTertiary}
                value={title}
                onChangeText={setTitle}
                style={input}
              />
              <TextInput
                accessibilityLabel="Your note"
                placeholder="What would you like to remember?"
                placeholderTextColor={colors.fgTertiary}
                value={note}
                onChangeText={setNote}
                style={input}
                multiline
              />
            </>
          ) : null}
          {error ? <Notice message={error} error /> : null}
          <Notice message="Private to you. Sharing is always your choice." />
          <Button
            title={isPrivate ? "Save privately" : "Save to Inbox"}
            primary
            onPress={submit}
            disabled={!url.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
