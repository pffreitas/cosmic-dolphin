import React, { useEffect, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/hooks/useTheme";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
import { Button, layout } from "./ui/Signal";
export function CopiedLink({ onPaste }: { onPaste: (value: string) => void }) {
  const [available, setAvailable] = useState(false);
  const { colors } = useTheme();
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
    <Text style={[textStyle("bodySm"), { color: colors.fgSecondary, flexShrink: 1 }]}>Paste copied link</Text>
    {Platform.OS === "ios" ? <Clipboard.ClipboardPasteButton accessibilityLabel="Paste" acceptedContentTypes={["url"]} foregroundColor={colors.accentFg} backgroundColor={colors.accent} style={{ width: space.s7 * 3 * fontScale, height: space.s6 * 2 * fontScale }} onPress={event => { if (event.type === "text") onPaste(event.text); }} /> : <Button title="Paste" onPress={() => { void Clipboard.getStringAsync().then(onPaste).catch(() => {}); }} />}
  </View>;
}
