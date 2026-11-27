import React, { useState } from "react";
import { Pressable, Text, View, type TextStyle, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { radius, webEffects } from "@/constants/theme";
import { useControlFocus } from "@/hooks/useControlFocus";
import { useWebTheme, webText } from "./theme";

/** Same visible geometry as web; invisible hit slop supplies native touch targets. */
export function Action({ label, icon: Icon, children, onPress, selected, disabled, primary, style }: {
  label: string; icon?: LucideIcon; children?: React.ReactNode; onPress?: () => void;
  selected?: boolean; disabled?: boolean; primary?: boolean; style?: ViewStyle;
}) {
  const { colors } = useWebTheme();
  const { focusStyle, ...focusEvents } = useControlFocus();
  return <Pressable {...focusEvents} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || !onPress, ...(selected === undefined ? {} : { selected }) }}
    disabled={disabled || !onPress} onPress={onPress} hitSlop={6}
    style={({ pressed }) => [{ minHeight: 32, paddingHorizontal: primary ? 14 : 8,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderRadius: primary ? radius.pill : radius.sm,
      backgroundColor: primary ? colors.accent : pressed ? colors.bgInset : "transparent" }, focusStyle, { outlineColor: colors.focus }, style]}>
    {Icon ? <Icon size={15} strokeWidth={1.7} color={primary ? colors.accentFg : colors.fgSecondary} /> : null}
    {typeof children === "string" || typeof children === "number" ? <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: "InterMedium", fontSize: 12.5, lineHeight: 12.5, color: primary ? colors.accentFg : colors.fgSecondary }}>{children}</Text> : children}
  </Pressable>;
}
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  const { colors, scheme } = useWebTheme();
  const [focused, setFocused] = useState<T>();
  return <View accessibilityRole="radiogroup" accessibilityLabel="Feed scope" style={{ flexDirection: "row", alignSelf: "flex-start", padding: 3, gap: 2, borderRadius: radius.pill, backgroundColor: colors.bgInset }}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
      accessible accessibilityState={{ checked: value === option.value }} onFocus={() => setFocused(option.value)} onBlur={() => setFocused(undefined)} onPress={() => onChange(option.value)} hitSlop={{ top: 6, bottom: 6 }}
      style={{ minHeight: 32, minWidth: 64, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: radius.pill,
        backgroundColor: value === option.value ? colors.bgPanel : "transparent",
        outlineWidth: focused === option.value ? 2 : 0, outlineOffset: 2, outlineColor: colors.focus,
        ...(value === option.value ? { boxShadow: webEffects[scheme].shadowSegment } : {}) }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: "InterMedium", fontSize: 12.5, lineHeight: 12.5, color: value === option.value ? colors.fg : colors.fgSecondary }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
export function Tag({ children }: { children: string }) {
  const { colors } = useWebTheme();
  return <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }}>
    <Text style={{ fontFamily: "InterMedium", fontSize: 12, lineHeight: 12, color: colors.fgSecondary }}>{children}</Text>
  </View>;
}
export function Copy({ children, role = "bodySm", style, lines, maxFontSizeMultiplier }: { maxFontSizeMultiplier?: number; children: React.ReactNode; role?: Parameters<typeof webText>[0]; style?: TextStyle; lines?: number }) {
  const { colors } = useWebTheme();
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={lines} style={[webText(role), { color: colors.fgSecondary }, style]}>{children}</Text>;
}
