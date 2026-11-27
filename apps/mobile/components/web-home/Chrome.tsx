import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, DeviceEventEmitter, Modal, Pressable, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Library, Plus, Search, User, PanelLeft, Link2 } from "lucide-react-native";
import { useNavigation, useRouter } from "expo-router";
import type { BookmarkLibraryCounts } from "@cosmic-dolphin/api-client";
import { radius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCaptures } from "@/contexts/CaptureContext";
import { captureUrl } from "./data";
import { BrandMark } from "@/components/BrandMark";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { HomeSidebar } from "./Sidebar";
import { Action, Copy } from "./Primitives";
import { useWebTheme } from "./theme";

export const FOCUS_HOME_SEARCH = "cosmic:focus-home-omnibox";

export function HomeToolbar({ onError, counts = null }: { onError: (message: string) => void; counts?: BookmarkLibraryCounts | null }) {
  const { colors } = useWebTheme();
  const { user } = useAuth();
  const router = useRouter();
  const rootNavigation = useNavigation("/");
  const { save } = useCaptures();
  const input = useRef<TextInput>(null);
  const navButton = useRef<View>(null);
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState(false);
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
  const closeMenu = () => { setMenu(false); requestAnimationFrame(() => { navButton.current?.focus(); const node = findNodeHandle(navButton.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }); };
  const go = (href: "/" | "/library" | "/search" | "/profile" | "/explore") => { setMenu(false); if (href === "/profile") rootNavigation.navigate("profile" as never); else router.push(href); };
  return <>
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, zIndex: 30 }}>
      <Action label="Open navigation" icon={PanelLeft} iconSize={16} controlRef={navButton} onPress={() => { input.current?.blur(); setMenu(true); }} style={{ width: 34, height: 34 }} />
      <View style={{ width: 32, height: 32 }}><BrandMark size={32} /><View pointerEvents="none" style={{ position: "absolute", inset: 0, borderWidth: 1, borderColor: colors.brandEdge, borderRadius: radius.md }} /></View>
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
          {capture ? <Action label="Behind a login" onPress={() => { input.current?.blur(); router.push({ pathname: "/save", params: { url: capture, accountId: user?.id } }); }}>Behind a login?</Action> : null}
        </View> : null}
      </View>
    </View>
    <Modal visible={menu} transparent animationType="none" onRequestClose={closeMenu}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Pressable accessibilityLabel="Close navigation" onPress={closeMenu} style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: colors.overlay }} />
        {menu ? <HomeSidebar counts={counts} reducedMotion={reducedMotion} onClose={closeMenu} onDestination={go} onLibrary={query => { setMenu(false); router.push({ pathname: "/library", params: query }); }} /> : null}
      </View>
    </Modal>
  </>;
}

/** Five web navigation cells on Home; OS bottom inset is an explicit native addition. */
export function HomeTabBar() {
  const { colors, scheme } = useWebTheme();
  const router = useRouter();
  const rootNavigation = useNavigation("/");
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState<string>();
  const items = [
    { label: "Home", icon: Home, onPress: () => router.push("/"), active: true },
    { label: "Library", icon: Library, onPress: () => router.push("/library") },
    { label: "Save", icon: Plus, onPress: () => router.push("/save") },
    { label: "Search", icon: Search, onPress: () => DeviceEventEmitter.emit(FOCUS_HOME_SEARCH) },
    { label: "You", icon: User, onPress: () => rootNavigation.navigate("profile" as never) },
  ];
  return <BlurView intensity={20} tint={scheme === "dark" ? "dark" : "light"} style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.navSurface, paddingBottom: insets.bottom }}>
    <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 8, paddingVertical: 4, gap: 4, flexDirection: "row" }}>
      {items.map(({ label, icon: Icon, onPress, active }) => <Pressable key={label} accessibilityRole={label === "Save" || label === "Search" ? "button" : "tab"} accessibilityLabel={label} accessibilityState={{ selected: !!active }} onFocus={() => setFocused(label)} onBlur={() => setFocused(undefined)} onPress={onPress}
        style={{ flex: 1, outlineWidth: focused === label ? 2 : 0, outlineColor: colors.focus, outlineOffset: 2, minHeight: 44, paddingVertical: 6, paddingHorizontal: 4, gap: 4, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: active ? colors.accentSoft : "transparent" }}>
        <Icon size={18} strokeWidth={1.8} color={active ? colors.accent : colors.fgSecondary} /><Copy maxFontSizeMultiplier={1.3} style={{ fontFamily: "InterMedium", fontSize: 11, lineHeight: 11, color: active ? colors.accent : colors.fgSecondary }}>{label}</Copy>
      </Pressable>)}
    </View>
  </BlurView>;
}
