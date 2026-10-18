import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { TopBar, TopBarAction } from "@/components/TopBar";

export function Screen({
  children,
  title,
  onBack,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <TopBar title={title} onBack={onBack} actions={actions} />
      <View
        style={{ flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
export function PageHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.s2, marginBottom: space.s5 }}>
      <Text
        accessibilityRole="header"
        style={[textStyle("title1"), { color: colors.fg }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
export function Button({
  title,
  onPress,
  primary,
  busy,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const foreground = primary ? colors.accentFg : colors.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: primary ? radius.pill : radius.sm,
          borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.borderStrong,
          backgroundColor: primary ? colors.accent : colors.bgPanel,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={foreground} />
      ) : null}
      <Text
        style={[
          textStyle("bodySm"),
          { color: foreground, fontFamily: "InterSemibold", flexShrink: 1 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: selected
            ? colors.accent
            : pressed
              ? colors.bgInset
              : colors.bgPanel,
        },
      ]}
    >
      <Text
        style={[
          textStyle("meta"),
          { color: selected ? colors.accentFg : colors.fgSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segments, { backgroundColor: colors.bgInset }]}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[
            styles.segment,
            {
              backgroundColor:
                value === option.value ? colors.bgPanel : "transparent",
            },
          ]}
        >
          <Text
            style={[
              textStyle("meta"),
              {
                color: value === option.value ? colors.fg : colors.fgSecondary,
              },
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Notice({
  message,
  error = false,
  action,
  onAction,
}: {
  message: string;
  error?: boolean;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        { borderColor: colors.border, backgroundColor: colors.bgSubtle },
      ]}
    >
      <Text
        style={[
          textStyle("bodySm"),
          { color: error ? colors.danger : colors.fgSecondary, flex: 1 },
        ]}
      >
        {message}
      </Text>
      {action && onAction ? <Button title={action} onPress={onAction} /> : null}
    </View>
  );
}
export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text
        accessibilityRole="header"
        style={[textStyle("title2"), { color: colors.fg, textAlign: "center" }]}
      >
        {title}
      </Text>
      <Text
        style={[
          textStyle("bodySm"),
          { color: colors.fgSecondary, textAlign: "center" },
        ]}
      >
        {description}
      </Text>
      {action && onAction ? (
        <Button title={action} onPress={onAction} primary />
      ) : null}
    </View>
  );
}
export function SkeletonRows() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading content" accessibilityRole="progressbar">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            gap: space.s3,
            paddingVertical: space.s5,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          {[55, 90, 80].map((width, n) => (
            <View
              key={n}
              style={{
                width: `${width}%`,
                height: n === 1 ? space.s5 : space.s3,
                backgroundColor: colors.bgInset,
                borderRadius: radius.xs,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
export function Sheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss dialog"
          accessibilityRole="button"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <SafeAreaView
            edges={["bottom"]}
            style={[styles.sheet, { backgroundColor: colors.bgPanel }]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHeader}>
              <Text
                accessibilityRole="header"
                style={[textStyle("title2"), { color: colors.fg, flex: 1 }]}
              >
                {title}
              </Text>
              <TopBarAction
                icon="close"
                label="Close dialog"
                onPress={onClose}
              />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: space.s5,
                paddingTop: space.s2,
                gap: space.s4,
              }}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
export const layout = StyleSheet.create({
  content: { padding: space.s5, paddingBottom: space.s7, gap: space.s4 },
  row: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s2,
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.s3,
    ...textStyle("body"),
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.s4,
    gap: space.s3,
  },
});
const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s2,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: space.s4,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segments: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: space.s1,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
  },
  notice: {
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.s2,
    flexDirection: "row",
    alignItems: "center",
  },
  empty: { paddingVertical: space.s7, gap: space.s4, alignItems: "center" },
  scrim: { flex: 1, justifyContent: "flex-end" },
  sheetWrap: { width: "100%", maxHeight: "85%" },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "100%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
  },
});
