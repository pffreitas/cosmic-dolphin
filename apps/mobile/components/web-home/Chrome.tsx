import React, { useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, StatusBar, TextInput, View } from "react-native";
import { Search, Link2 } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { radius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCaptures } from "@/contexts/CaptureContext";
import { captureUrl } from "./data";
import { BrandMark } from "@/components/BrandMark";
import { Action, Copy } from "./Primitives";
import { StarfieldHeaderTheme, useWebTheme } from "./theme";
import { StarfieldHeaderBackground } from "./StarfieldHeaderBackground";

export const FOCUS_HOME_SEARCH = "cosmic:focus-home-omnibox";

export function HomeToolbar({ onError }: { onError: (message: string) => void }) {
  return <StarfieldHeaderTheme.Provider value><ToolbarControls onError={onError} /></StarfieldHeaderTheme.Provider>;
}
function ToolbarControls({ onError }: { onError: (message: string) => void }) {
  const { colors } = useWebTheme();
  useFocusEffect(React.useCallback(() => {
    const entry = StatusBar.pushStackEntry({ barStyle: "light-content", backgroundColor: colors.skyBg, translucent: false });
    return () => StatusBar.popStackEntry(entry);
  }, [colors.skyBg]));
  const { user } = useAuth();
  const router = useRouter();
  const { save } = useCaptures();
  const input = useRef<TextInput>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [limited, setLimited] = useState<string>();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { const listener = DeviceEventEmitter.addListener(FOCUS_HOME_SEARCH, () => input.current?.focus()); return () => listener.remove(); }, []);
  const capture = captureUrl(value);
  const submit = async () => {
    const text = value.trim();
    if (!text || !user) return;
    if (!capture) { input.current?.blur(); router.push({ pathname: "/search", params: { q: text } }); return; }
    setValue(""); input.current?.blur();
    try { await save({ sourceUrl: capture, captureSource: "save_sheet", capturePlatform: "unknown" }); }
    catch { if (alive.current) { setValue(text); setLimited("Couldn't save this link. Try again."); onError("Couldn't save this link."); } }
  };
  return <>
    <View style={{ height: 72, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, zIndex: 30 }}>
      <StarfieldHeaderBackground />
      <BrandMark size={32} />
      <View style={{ flex: 1, position: "relative" }}>
        <View style={{ height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: focused ? colors.accent : colors.border, backgroundColor: focused ? colors.bgPanel : colors.bgSubtle, outlineWidth: focused ? 2 : 0, outlineColor: colors.focus, outlineOffset: 2, flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 4, gap: 10 }}>
          {capture ? <Link2 size={16} strokeWidth={1.8} color={colors.accent} /> : <Search size={16} strokeWidth={1.8} color={colors.fgTertiary} />}
          <TextInput ref={input} accessibilityLabel="Paste a link to save it, or search your library" placeholder="Paste a link or search" placeholderTextColor={colors.fgTertiary} value={value}
            onChangeText={text => { setValue(text); setLimited(undefined); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onSubmitEditing={() => { void submit(); }} returnKeyType={capture ? "go" : "search"} autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, minWidth: 0, height: 34, padding: 0, fontFamily: "Inter", fontSize: 13.5, color: colors.fg, outlineColor: colors.focus }} />
          {capture ? <Action label="Save" primary onPress={() => { void submit(); }} style={{ minHeight: 28, borderRadius: radius.sm, paddingHorizontal: 10 }}>Save</Action> : null}
        </View>
        {focused || limited ? <View style={{ position: "absolute", top: 42, left: 0, right: 0, padding: 12, gap: 8, backgroundColor: colors.bgPanel, borderWidth: 1, borderRadius: radius.md, borderColor: colors.border }}>
          <Copy role="meta">{limited || (capture ? `Press Enter to save ${new URL(capture).hostname}` : value ? `Press Enter to search your library for “${value}”` : "Paste a link to save it, or type to search your library.")}</Copy>
          {capture ? <Action label="Behind a login" onPress={() => { input.current?.blur(); router.push({ pathname: "/save", params: { url: capture, accountId: user?.id, privateLink: "true", captureSource: "save_sheet" } }); }}>Behind a login?</Action> : null}
        </View> : null}
      </View>
    </View>
  </>;
}
