import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, Keyboard, Modal, Pressable, View } from "react-native";
import { BlurView } from "expo-blur";
import { Menu } from "lucide-react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookmarkLibraryCounts } from "@cosmic-dolphin/api-client";
import { radius, space, webEffects } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { HomeFeedFixtureContext } from "@/hooks/HomeFeedFixtureContext";
import { useControlFocus } from "@/hooks/useControlFocus";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MobileAPI } from "@/lib/mobile-api";
import { HomeSidebar } from "./Sidebar";
import { useWebTheme } from "./theme";

type Props = { counts?: BookmarkLibraryCounts | null; homeActive?: boolean };

/** One compact navigation door, with a contrasting fill and OS insets. */
export function FloatingNavigation(props: Props) {
  const { user } = useAuth();
  return <NavigationControl key={user?.id ?? "signed-out"} {...props} />;
}

function NavigationControl({ counts, homeActive = true }: Props) {
  const { colors, scheme } = useWebTheme();
  const { user } = useAuth();
  const fixture = useContext(HomeFeedFixtureContext);
  const router = useRouter();
  const rootNavigation = useNavigation("/");
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const navButton = useRef<View>(null);
  const { focusStyle, ...focusEvents } = useControlFocus();
  const [menu, setMenu] = useState(false);
  const [loadedCounts, setLoadedCounts] = useState<BookmarkLibraryCounts | null>(null);
  useFocusEffect(useCallback(() => () => setMenu(false), []));
  useEffect(() => {
    if (!menu || counts !== undefined || fixture || !user?.id) return;
    let current = true;
    void MobileAPI.counts().then(value => { if (current) setLoadedCounts(value); }).catch(() => {});
    return () => { current = false; };
  }, [menu, counts, fixture, user?.id]);
  const closeMenu = () => {
    setMenu(false);
    requestAnimationFrame(() => {
      navButton.current?.focus();
      const node = findNodeHandle(navButton.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
  };
  const go = (href: "/" | "/search" | "/profile" | "/explore" | "/save") => {
    setMenu(false);
    if (href === "/profile") rootNavigation.navigate("profile" as never);
    else router.push(href);
  };
  return <>
    <View style={[{ position: "absolute", left: insets.left + space.s4, bottom: insets.bottom + space.s4, zIndex: 40, borderRadius: radius.pill, boxShadow: webEffects[scheme].shadowFloatingNav }, focusStyle, { outlineColor: colors.focus }]}>
      <BlurView intensity={20} tint={scheme === "dark" ? "dark" : "light"} style={{ borderRadius: radius.pill, overflow: "hidden" }}>
        <Pressable ref={navButton} {...focusEvents} accessibilityRole="button" accessibilityLabel="Open navigation" accessibilityState={{ expanded: menu }}
          onPress={() => { Keyboard.dismiss(); setMenu(true); }}
          style={({ pressed }) => ({ width: space.s7, height: space.s7, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: pressed ? colors.accentHover : colors.navSurface })}>
          <Menu size={20} strokeWidth={1.8} color={colors.accentFg} />
        </Pressable>
      </BlurView>
    </View>
    <Modal visible={menu} transparent animationType="none" onRequestClose={closeMenu}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Pressable accessibilityLabel="Close navigation" onPress={closeMenu} style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: colors.overlay }} />
        {menu ? <HomeSidebar homeActive={homeActive} counts={counts ?? fixture?.counts ?? loadedCounts} reducedMotion={reducedMotion} onClose={closeMenu} onDestination={go}
          onLibrary={query => { setMenu(false); router.push({ pathname: "/library", params: query }); }} /> : null}
      </View>
    </Modal>
  </>;
}
