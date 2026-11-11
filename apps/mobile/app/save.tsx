import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Chip, layout, Notice, PageHeading, Screen } from "@/components/ui/Signal";
import { CaptureFailureToast } from "@/components/CaptureFailureToast";
import { CopiedLink } from "@/components/CopiedLink";
import { useTheme } from "@/hooks/useTheme";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { textStyle } from "@/constants/fonts";
import { readWhen, savedReadWhenCopy, type SaveReadWhen } from "@/lib/read-when";
export default function SaveScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ url?: string; accountId?: string }>();
  const scope = useRef({ accountId: user?.id, generation: 0 });
  if (scope.current.accountId !== user?.id) {
    scope.current = { accountId: user?.id, generation: scope.current.generation + 1 };
  }
  const identity = scope.current;
  const pastedUrl = identity.generation === 0 && typeof params.url === "string"
    && (typeof params.accountId === "string" && params.accountId === user?.id) ? params.url : "";
  // A new account gets a fresh form synchronously, including confirmation fields.
  return <SaveForm key={identity.generation} pastedUrl={pastedUrl} isCurrent={() => scope.current === identity} />;
}
function SaveForm({ pastedUrl, isCurrent }: { pastedUrl: string; isCurrent: () => boolean }) {
  const router = useRouter();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && isCurrent();
  const { colors } = useTheme();
  const { save, confirm, captures } = useCaptures();
  const [source, setSource] = useState<"save_sheet" | "clipboard">(pastedUrl ? "clipboard" : "save_sheet");
  const [url, setUrl] = useState(pastedUrl);
  const [isPrivate, setPrivate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<SaveReadWhen>("No rush");
  const [savedId, setSavedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const capture = captures.find(value => value.id === savedId);
  const submit = async () => {
    if (!current() || submitting.current || savedId) return;
    try {
      const parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw Error();
    } catch { setError("Enter a complete http or https link."); return; }
    if (isPrivate && (!title.trim() || !description.trim())) {
      setError("Add a title and description for this private link."); return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await save({ sourceUrl: url.trim(), captureSource: source,
        capturePlatform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
        ...(isPrivate ? { isPrivateLink: true, title: title.trim(), description: description.trim() } : {}) });
      if (current()) setSavedId(id);
    } catch { if (current()) setError("Couldn't save on this phone. Try again."); }
    finally { submitting.current = false; if (current()) setBusy(false); }
  };
  const finish = async () => {
    if (!current() || !savedId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await confirm(savedId, note, readWhen(when));
      if (!current()) return;
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    } catch { if (current()) setError("Change was not saved. Check your connection."); }
    finally { submitting.current = false; if (current()) setBusy(false); }
  };
  const input = [layout.input, { backgroundColor: colors.bgPanel, color: colors.fg, borderColor: colors.borderStrong }];
  const label = [textStyle("bodySm"), { color: colors.fg }];
  return <Screen title="Save a link" onBack={() => { if (current()) router.back(); }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={layout.content} keyboardShouldPersistTaps="handled">
        {savedId ? <>
          <PageHeading title={capture?.status === "saved" ? capture.alreadySaved ? "Already in your Library" : capture.bookmark?.isPrivateLink ? "Private link saved" : "Saved. Cosmic is reading it." : "Saved on this phone"} />
          <Text style={label}>{url}</Text>
          {capture?.status !== "saved" ? <Notice message="Saved on this phone. Cosmic reads it when you open the app." /> : null}
          <Text style={label}>Read when</Text>
          <View style={[layout.row, { flexWrap: "wrap" }]}>
            {(["Tonight", "This weekend", "No rush"] as const).map(option => <Chip key={option} label={option} selected={when === option} onPress={() => setWhen(option)} />)}
          </View>
          <Text style={label}>Note (optional)</Text>
          <TextInput accessibilityLabel="Note (optional)" value={note} onChangeText={setNote} maxLength={500} multiline placeholder="Why you’re saving it" placeholderTextColor={colors.fgTertiary} style={input} />
          <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>Private to you. Up to 500 characters.</Text>
          {when !== "No rush" ? <Notice message={savedReadWhenCopy(readWhen(when))} /> : null}
          <Button title="Done" primary busy={busy} onPress={finish} />
        </> : <>
          <PageHeading title="Keep something worthwhile." subtitle="Save the link now. Cosmic can read it while you do something else." />
          <CopiedLink onPaste={value => { setUrl(value.trim()); setSource("clipboard"); }} />
          <Text style={label}>Link</Text>
          <TextInput accessibilityLabel="Link" value={url} onChangeText={value => { setUrl(value); setSource("save_sheet"); }} placeholder="https://…" placeholderTextColor={colors.fgTertiary} keyboardType="url" autoCapitalize="none" autoCorrect={false} style={input} returnKeyType="done" onSubmitEditing={() => { if (!isPrivate) void submit(); }} />
          <Text style={label}>Page behind a login?</Text>
          <Switch accessibilityLabel="Page behind a login" value={isPrivate} onValueChange={setPrivate} trackColor={{ false: colors.borderStrong, true: colors.accent }} />
          {isPrivate ? <>
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>Cosmic cannot fetch a page behind a login. Add a title and description so Cosmic can organise the link without opening its page.</Text>
            <TextInput accessibilityLabel="Your title" placeholder="Your title" placeholderTextColor={colors.fgTertiary} value={title} onChangeText={setTitle} style={input} />
            <TextInput accessibilityLabel="Describe this link" placeholder="What should you remember about this page?" placeholderTextColor={colors.fgTertiary} value={description} onChangeText={setDescription} style={input} multiline />
          </> : null}
          <Notice message="Private to you. Sharing is always your choice." />
          <Button title="Save" primary onPress={submit} busy={busy} />
        </>}
        {error && error !== "Change was not saved. Check your connection." ? <Notice message={error} error /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    <CaptureFailureToast message={error === "Change was not saved. Check your connection." ? error : undefined} />
  </Screen>;
}
