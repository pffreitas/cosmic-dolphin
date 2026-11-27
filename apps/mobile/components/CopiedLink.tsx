import React, { useEffect, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
import { Button, layout } from "./ui/Signal";
import { useWebTheme, webText } from "./web-home/theme";
import { Action, Copy } from "./web-home/Primitives";
export function CopiedLink({ onPaste, appearance }: { onPaste: (value: string) => void; appearance?: "web" }) {
  const [available, setAvailable] = useState(false);
  const { colors } = useTheme();
  const web = useWebTheme();
  const palette = appearance === "web" ? web.colors : colors;
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    if (Platform.OS === "ios" && !Clipboard.isPasteButtonAvailable) return;
    let active = true;
    const detect = async () => {
      const hasUrl = Platform.OS === "ios" ? await Clipboard.hasUrlAsync() : Platform.OS === "android" ? await requireOptionalNativeModule<{ hasUrl: () => Promise<boolean> }>("CosmicClipboardUrl")?.hasUrl() : false;
      if (active) setAvailable(hasUrl === true);
    };
    void detect().catch(() => {});
    const subscription = Clipboard.addClipboardListener?.(() => { void detect().catch(() => {}); });
    return () => { active = false; subscription?.remove(); };
  }, []);
  if (!available) return null;
  return <View style={[layout.row, { flexWrap: "wrap" }]}>
    <Text style={[appearance === "web" ? webText("bodySm") : textStyle("bodySm"), { color: palette.fgSecondary, flexShrink: 1 }]}>Paste copied link</Text>
    {Platform.OS === "ios" ? <Clipboard.ClipboardPasteButton accessibilityLabel="Paste" acceptedContentTypes={["url"]} foregroundColor={palette.accentFg} backgroundColor={palette.accent} style={{ width: space.s7 * 3 * fontScale, height: space.s6 * 2 * fontScale }} onPress={event => { if (event.type === "text") onPaste(event.text); }} /> : appearance === "web" ? <Action label="Paste" primary onPress={() => { void Clipboard.getStringAsync().then(onPaste).catch(() => {}); }} style={{ minHeight: 36, paddingHorizontal: 18 }}><Copy maxFontSizeMultiplier={1.3} style={{ fontSize: 13.5, lineHeight: 13.5, color: palette.accentFg }}>Paste</Copy></Action> : <Button title="Paste" onPress={() => { void Clipboard.getStringAsync().then(onPaste).catch(() => {}); }} />}
  </View>;
}
