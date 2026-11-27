import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  PixelRatio,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Archive,
  Check,
  ChevronsUpDown,
  Clock3,
  Compass,
  Folder,
  Home,
  Inbox,
  Layers,
  LogOut,
  Search,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type {
  BookmarkLibraryCounts,
  Collection,
} from "@cosmic-dolphin/api-client";
import { motion, radius, webEffects } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { HomeFeedFixtureContext } from "@/hooks/HomeFeedFixtureContext";
import { useControlFocus } from "@/hooks/useControlFocus";
import { MobileAPI } from "@/lib/mobile-api";
import { PrettyCopy } from "./PrettyCopy";
import { Action, Copy } from "./Primitives";
import { identitySlot } from "./data";
import {
  sidebarCollections,
  sidebarLibraryRows,
  type SidebarLibraryQuery,
} from "./sidebar-data";
import { useWebTheme, webText, webSansFont } from "./theme";

/** Compact production web Sidebar; OS safe areas are outside the product bounds. */
export function HomeSidebar({
  counts,
  reducedMotion = true,
  homeActive = true,
  onClose,
  onDestination,
  onLibrary,
}: {
  counts: BookmarkLibraryCounts | null;
  reducedMotion?: boolean;
  homeActive?: boolean;
  onClose: () => void;
  onDestination: (
    destination: "/" | "/explore" | "/search" | "/profile",
  ) => void;
  onLibrary: (query: SidebarLibraryQuery) => void;
}) {
  const { user } = useAuth();
  // Reset collection requests, account popup and image failures before owner B paints.
  return (
    <SidebarContent
      key={user?.id ?? "signed-out"}
      counts={counts}
      reducedMotion={reducedMotion}
      homeActive={homeActive}
      onClose={onClose}
      onDestination={onDestination}
      onLibrary={onLibrary}
    />
  );
}
function SidebarContent({
  counts,
  reducedMotion,
  homeActive,
  onClose,
  onDestination,
  onLibrary,
}: Parameters<typeof HomeSidebar>[0]) {
  const { colors, scheme } = useWebTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut, signOutBusy, signOutError } = useAuth();
  const { appearance, update } = usePreferences();
  const context = useContext(HomeFeedFixtureContext);
  const fixture = __DEV__ ? context : undefined;
  const [collections, setCollections] = useState<Collection[]>(
    fixture?.collections ?? [],
  );
  const [loading, setLoading] = useState(!fixture);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [account, setAccount] = useState(false);
  const { focusStyle: brandFocusStyle, ...brandFocusEvents } =
    useControlFocus();
  const { focusStyle: accountFocusStyle, ...accountFocusEvents } =
    useControlFocus();
  const [brandBounds, setBrandBounds] = useState({ width: 0, height: 0 });
  const [imageFailed, setImageFailed] = useState(false);
  const slide = useRef(new Animated.Value(reducedMotion ? 0 : -288)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: reducedMotion ? 0 : 300,
      easing: Easing.bezier(...motion.easing),
      useNativeDriver: true,
    }).start();
    return () => slide.stopAnimation();
  }, [slide, reducedMotion]);
  useEffect(() => {
    if (fixture) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setFailed(false);
    void MobileAPI.collections(user.id)
      .then((result) => {
        if (current) setCollections(result);
      })
      .catch(() => {
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [user?.id, fixture, retry]);
  const name =
    fixture?.readerName ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "You";
  const email = fixture?.readerEmail ?? user?.email;
  const avatar = fixture
    ? undefined
    : (user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture);
  useEffect(() => setImageFailed(false), [avatar]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("");
  const slot = identitySlot(initials);
  const identity = colors as unknown as Record<string, string>;
  const tree = sidebarCollections(fixture?.collections ?? collections, counts);
  const icons = {
    all: Layers,
    inbox: Inbox,
    "read-later": Clock3,
    archive: Archive,
  };
  const normal = webSansFont();
  const medium = webSansFont(500);
  return (
    <Animated.View
      accessibilityViewIsModal
      onAccessibilityEscape={account ? () => setAccount(false) : onClose}
      style={{
        width: 288,
        maxWidth: "85%",
        height: "100%",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: colors.bgSubtle,
        borderRightWidth: 1,
        borderColor: colors.border,
        boxShadow: webEffects[scheme].shadowDialog,
        transform: [{ translateX: slide }],
      }}
    >
      <View
        style={{ height: 56, paddingHorizontal: 20, justifyContent: "center" }}
      >
        <Pressable
          {...brandFocusEvents}
          onLayout={({ nativeEvent: { layout } }) =>
            setBrandBounds({ width: layout.width, height: layout.height })
          }
          accessibilityRole="button"
          accessibilityLabel="Cosmic Dolphin home"
          onPress={() => onDestination("/")}
          hitSlop={6}
          style={[
            {
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 4,
              paddingRight: 12,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: colors.brandEdge,
              borderRadius: radius.pill,
              overflow: "hidden",
              backgroundColor: colors.brandBlack,
              maxWidth: "100%",
            },
            brandFocusStyle,
            { outlineColor: colors.focus },
          ]}
        >
          <Image
            accessible={false}
            source={require("@/assets/images/brand-gradient.png")}
            resizeMode="stretch"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: brandBounds.width,
              height: brandBounds.height,
            }}
          />
          <Image
            accessible={false}
            source={require("@/assets/images/brand-mark.png")}
            style={{ width: 40, height: 40 }}
          />
          <Copy
            role="label"
            maxFontSizeMultiplier={1.3}
            lines={1}
            style={{
              fontSize: 15,
              lineHeight: 15,
              letterSpacing: -0.225 * Math.min(PixelRatio.getFontScale(), 1.3),
              color: colors.brandFg,
            }}
          >
            Cosmic Dolphin
          </Copy>
        </Pressable>
      </View>
      <View style={{ position: "absolute", top: insets.top + 12, right: 12 }}>
        <Action
          label="Close navigation"
          icon={X}
          iconSize={16}
          onPress={onClose}
          style={{ width: 32, height: 32, paddingHorizontal: 0 }}
        />
      </View>
      <ScrollView
        accessibilityLabel="Navigation"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 24,
          gap: 24,
        }}
      >
        <View style={{ gap: 1 }}>
          <SidebarRow
            label="Home"
            icon={Home}
            active={homeActive}
            onPress={() => onDestination("/")}
          />
          <SidebarRow
            label="Explore"
            icon={Compass}
            onPress={() => onDestination("/explore")}
          />
          <SidebarRow
            label="Search"
            icon={Search}
            onPress={() => onDestination("/search")}
          />
        </View>
        <View style={{ gap: 4 }}>
          <GroupLabel>Library</GroupLabel>
          <View style={{ gap: 1 }}>
            {sidebarLibraryRows(counts).map((row) => (
              <SidebarRow
                key={row.key}
                label={row.label}
                icon={icons[row.key]}
                count={row.count ?? "—"}
                onPress={() => onLibrary(row.query)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <GroupLabel>Collections</GroupLabel>
          {loading ? (
            <Copy
              role="meta"
              maxFontSizeMultiplier={1.3}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                color: colors.fgTertiary,
              }}
            >
              Loading collections…
            </Copy>
          ) : failed ? (
            <View style={{ paddingHorizontal: 10, gap: 4 }}>
              <Copy role="meta">Collections couldn’t load.</Copy>
              <Action
                label="Retry collections"
                onPress={() => setRetry((value) => value + 1)}
              >
                Retry
              </Action>
            </View>
          ) : tree.length ? (
            <View style={{ gap: 1 }}>
              {tree.map((node) => (
                <View key={node.id}>
                  <SidebarRow
                    label={node.name}
                    icon={Folder}
                    count={counts ? node.count : "—"}
                    onPress={() =>
                      onLibrary({ collectionId: node.id, name: node.name })
                    }
                  />
                  {node.children.length ? (
                    <View
                      style={{
                        marginLeft: 19,
                        borderLeftWidth: 1,
                        borderColor: colors.border,
                        paddingLeft: 8,
                        gap: 1,
                      }}
                    >
                      {node.children.map((child) => (
                        <SidebarRow
                          key={child.id}
                          label={child.name}
                          count={counts ? child.count : "—"}
                          onPress={() =>
                            onLibrary({
                              collectionId: child.id,
                              name: child.name,
                            })
                          }
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
              <PrettyCopy>
                Collections appear here as Cosmic finds groupings worth keeping.
              </PrettyCopy>
            </View>
          )}
        </View>
      </ScrollView>
      {user || fixture ? (
        <View
          style={{ borderTopWidth: 1, borderColor: colors.border, padding: 8 }}
        >
          <Pressable
            {...accountFocusEvents}
            accessibilityRole="button"
            accessibilityLabel={`${name} Account menu`}
            accessibilityState={{ expanded: account }}
            onPress={() => setAccount((value) => !value)}
            hitSlop={0}
            style={({ pressed }) => [
              {
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 8,
                borderRadius: radius.sm,
                backgroundColor:
                  account || pressed ? colors.bgInset : "transparent",
              },
              accountFocusStyle,
              { outlineColor: colors.focus },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.pill,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: identity[`id${slot}Bg`],
              }}
            >
              {avatar && !imageFailed ? (
                <Image
                  source={{ uri: avatar }}
                  style={{ width: 28, height: 28 }}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <Copy
                  role="label"
                  maxFontSizeMultiplier={1.3}
                  style={{ fontSize: 11, color: identity[`id${slot}`] }}
                >
                  {initials}
                </Copy>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Copy
                lines={1}
                maxFontSizeMultiplier={1.3}
                style={{
                  fontFamily: medium,
                  fontSize: 13,
                  lineHeight: 16.25,
                  color: colors.fg,
                }}
              >
                {name}
              </Copy>
              {email ? (
                <Copy
                  lines={1}
                  maxFontSizeMultiplier={1.3}
                  style={{
                    fontFamily: normal,
                    fontSize: 11.5,
                    lineHeight: 14.375,
                    color: colors.fgTertiary,
                  }}
                >
                  {email}
                </Copy>
              ) : null}
            </View>
            <ChevronsUpDown
              size={16}
              strokeWidth={1.7}
              color={colors.fgTertiary}
            />
          </Pressable>
        </View>
      ) : null}
      {account ? (
        <>
          <Pressable
            accessibilityLabel="Close account menu"
            onPress={() => setAccount(false)}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={() => setAccount(false)}
            accessibilityLabel="Account menu"
            style={{
              position: "absolute",
              bottom: insets.bottom + 56,
              left: 8,
              right: 8,
              maxHeight: "85%",
              padding: 4,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.bgPanel,
              boxShadow: webEffects[scheme].shadowPopover,
            }}
          >
            <ScrollView>
              <SidebarRow
                label="Your profile"
                icon={UserRound}
                onPress={() => onDestination("/profile")}
                menu
              />
              <Separator />
              <Copy
                role="label"
                maxFontSizeMultiplier={1.3}
                style={{
                  paddingHorizontal: 8,
                  paddingTop: 8,
                  paddingBottom: 4,
                  lineHeight: 17.25,
                  color: colors.fgTertiary,
                }}
              >
                Theme
              </Copy>
              {(["light", "dark", "system"] as const).map((value) => (
                <SidebarRow
                  key={value}
                  label={
                    value === "system"
                      ? "Match system"
                      : value === "light"
                        ? "Light"
                        : "Dark"
                  }
                  checked={appearance === value}
                  menu
                  radio
                  onPress={() => {
                    update({ appearance: value });
                    setAccount(false);
                  }}
                />
              ))}
              <Separator />
              <SidebarRow
                label={signOutBusy ? "Signing out…" : "Sign out"}
                icon={LogOut}
                menu
                disabled={signOutBusy}
                onPress={() => {
                  void signOut().catch(() => {});
                }}
              />
              {signOutError ? (
                <Copy role="meta" style={{ padding: 8, color: colors.danger }}>
                  {signOutError}
                </Copy>
              ) : null}
            </ScrollView>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}
function GroupLabel({ children }: { children: string }) {
  const { colors } = useWebTheme();
  return (
    <View
      style={{ height: 28, justifyContent: "center", paddingHorizontal: 10 }}
    >
      <Copy
        role="label"
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.fgTertiary }}
      >
        {children}
      </Copy>
    </View>
  );
}
function Separator() {
  const { colors } = useWebTheme();
  return (
    <View
      style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }}
    />
  );
}
function SidebarRow({
  label,
  icon: Icon,
  active,
  count,
  onPress,
  menu,
  radio,
  checked,
  disabled,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  count?: number | string;
  onPress: () => void;
  menu?: boolean;
  radio?: boolean;
  checked?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useWebTheme();
  const { focusStyle, ...focusEvents } = useControlFocus();
  const weight: TextStyle = { fontFamily: webSansFont(active ? 500 : 400) };
  return (
    <Pressable
      {...focusEvents}
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityLabel={label}
      accessibilityHint={count === undefined ? undefined : `${count} saves`}
      accessibilityState={{
        ...(active ? { selected: true } : {}),
        ...(radio ? { checked } : {}),
        disabled,
      }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        {
          minHeight: 32,
          paddingVertical: menu ? 6 : 0,
          paddingHorizontal: menu ? 8 : 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderRadius: radius.sm,
          backgroundColor: active
            ? colors.bgPanel
            : pressed
              ? colors.bgInset
              : "transparent",
          ...(active ? { boxShadow: `inset 0 0 0 1px ${colors.border}` } : {}),
          opacity: disabled ? 0.45 : 1,
        },
        focusStyle,
        { outlineColor: colors.focus },
      ]}
    >
      {Icon ? (
        <Icon
          size={16}
          strokeWidth={1.7}
          color={menu ? colors.fg : active ? colors.accent : colors.fgTertiary}
        />
      ) : null}
      {radio ? (
        <View style={{ width: 14 }}>
          {checked ? (
            <Check size={16} strokeWidth={2} color={colors.accent} />
          ) : null}
        </View>
      ) : null}
      <Copy
        role="bodySm"
        lines={1}
        maxFontSizeMultiplier={1.3}
        style={{
          flex: 1,
          minWidth: 0,
          lineHeight: menu ? 20.25 : 16,
          color: menu || active ? colors.fg : colors.fgSecondary,
          ...weight,
        }}
      >
        {label}
      </Copy>
      {count !== undefined ? (
        <Text
          maxFontSizeMultiplier={1.3}
          style={[
            webText("meta"),
            {
              fontSize: 11.5,
              fontVariant: ["tabular-nums"],
              color: colors.fgTertiary,
            },
          ]}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
