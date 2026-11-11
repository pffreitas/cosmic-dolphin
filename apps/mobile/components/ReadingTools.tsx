import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import type { Highlight } from "@cosmic-dolphin/api-client";
import { MobileAPI } from "@/lib/mobile-api";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { TopBarAction } from "./TopBar";
import { Button, EmptyState, layout, Sheet } from "./ui/Signal";

/** Existing private reader tools, kept separate from public comments and save notes. */
export function ReadingTools({ id, userId, body }: { id: string; userId?: string; body: string }) {
  const { colors } = useTheme();
  const preferences = usePreferences();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [sheet, setSheet] = useState<"appearance" | "highlight" | "highlights">();
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setHighlights([]);
    if (userId) void MobileAPI.highlights(id).then(value => { if (active) setHighlights(value); }).catch(() => {});
    return () => { active = false; };
  }, [id, userId]);
  return <>
    <View style={layout.row}>
      <TopBarAction icon="text-outline" label="Reading appearance" onPress={() => setSheet("appearance")} />
      {userId ? <>
        <TopBarAction icon="bookmarks-outline" label="Your highlights" onPress={() => setSheet("highlights")} />
        <TopBarAction icon="create-outline" label="Highlight a passage" onPress={() => { setQuote(""); setNote(""); setSheet("highlight"); }} />
      </> : null}
    </View>
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
  </>;
}
