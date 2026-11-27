import React, { useEffect, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, Lock, X, type LucideIcon } from "lucide-react-native";
import { radius, webEffects } from "@/constants/theme";
import { useControlFocus } from "@/hooks/useControlFocus";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CopiedLink } from "@/components/CopiedLink";
import { PrettyCopy } from "@/components/web-home/PrettyCopy";
import { BalancedTitle } from "@/components/web-home/BalancedTitle";
import { Copy } from "@/components/web-home/Primitives";
import { useWebTheme, webSansFont, webText } from "@/components/web-home/theme";
import type { SaveReadWhen } from "@/lib/read-when";

export type SaveSheetProps = {
  stage: "link" | "private" | "confirmation";
  url: string; description: string; note: string; when: SaveReadWhen;
  heading?: string; status?: string; timing?: string; error?: string; busy?: boolean; previewTitle?: string;
  onUrl: (value: string) => void; onPaste: (value: string) => void;
  onDescription: (value: string) => void; onNote: (value: string) => void; onWhen: (value: SaveReadWhen) => void;
  onPrivate: () => void; onSave: () => void; onDone: () => void; onClose: () => void;
  clipboard?: boolean;
};

/** The production web Dialog at its compact breakpoint, adapted for safe areas
 * and the keyboard. Confirmation remains native's durable optional second step. */
export function SaveSheet(props: SaveSheetProps) {
  const { colors, scheme } = useWebTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState<string>();
  useEffect(() => { if (props.error) AccessibilityInfo.announceForAccessibility(props.error); }, [props.error]);
  const focus = (name: string) => ({ onFocus: () => setFocused(name), onBlur: () => setFocused(undefined) });
  const focusStyle = (name: string) => ({ outlineWidth: focused === name ? 2 : 0, outlineColor: colors.focus, outlineOffset: 0 });
  const isPrivate = props.stage === "private", confirmation = props.stage === "confirmation";
  const error = props.error ? <PrettyCopy accessibilityRole="alert" strategy="short-tail" maxFontSizeMultiplier={0} style={{ lineHeight: 17.5, color: colors.danger }}>{props.error}</PrettyCopy> : null;
  const title = confirmation ? props.heading! : isPrivate ? "Save private link" : "Save a link";
  const input = { fontFamily: webSansFont(), fontSize: 14, lineHeight: 21.7, color: colors.fg,
    backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: props.error ? colors.danger : colors.borderStrong,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 };
  const label = { fontFamily: webSansFont(500), fontSize: 14, lineHeight: 20, color: colors.fg };
  return <Modal visible transparent animationType="none" onRequestClose={props.onClose}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <Pressable accessible={false} onPress={props.onClose} style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: colors.overlay }} />
    <View pointerEvents="box-none" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, justifyContent: "flex-end", alignItems: "center" }}>
      <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 520, maxHeight: "90%", backgroundColor: colors.bgPanel,
        borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, boxShadow: webEffects[scheme].shadowDialog }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
          <View style={{ gap: 6 }}>
            {confirmation ? <View style={{ paddingRight: 32 }}><BalancedTitle maxLines={6} style={[webText("title2"), { color: colors.fg, letterSpacing: 0 }]}>{title}</BalancedTitle></View> : <Text accessibilityRole="header" style={[webText("title2"), { color: colors.fg, letterSpacing: 0, paddingRight: 32 }]}>{title}</Text>}
            {!confirmation ? <PrettyCopy strategy="short-tail" role="bodySm" maxFontSizeMultiplier={0} style={{ lineHeight: 20.925, color: colors.fgSecondary }}>{isPrivate ? "We can't read or summarize this page, but we can keep it at hand. Add a short note and Cosmic Dolphin will organize it for quick access." : "Paste a URL. It appears in your library straight away — the summary catches up."}</PrettyCopy> : null}
          </View>
          {confirmation ? <>
            <Copy>{props.url}</Copy>
            {props.status ? <Copy role="meta">{props.status}</Copy> : null}
            <View style={{ gap: 6 }}>
              <Text style={label}>Read when</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["Tonight", "This weekend", "No rush"] as const).map(value => <SheetButton key={value} label={value} selected={props.when === value} onPress={() => props.onWhen(value)} />)}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>Note (optional)</Text>
              <TextInput {...focus("note")} accessibilityLabel="Note (optional)" multiline value={props.note} onChangeText={props.onNote} maxLength={500} placeholder="Why you’re saving it" placeholderTextColor={colors.fgTertiary} selectionColor={colors.accent} style={[input, { minHeight: 88, textAlignVertical: "top", paddingTop: 10 - 2 * fontScale, paddingBottom: 10 + 2 * fontScale }, focusStyle("note")]} />
              <Copy role="meta">Private to you. Up to 500 characters.</Copy>
            </View>
            {props.timing ? <Copy role="meta">{props.timing}</Copy> : null}
          </> : isPrivate ? <View style={{ gap: 16, marginHorizontal: -4, paddingHorizontal: 4, paddingVertical: 8 }}>
            <View style={{ gap: 6 }}>
              <Text style={[label, { color: colors.fgSecondary }]}>Link</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSubtle, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Link size={16} strokeWidth={1.7} color={colors.fgTertiary} />
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: webSansFont(), fontSize: 14, lineHeight: 20, color: colors.fg }}>{props.previewTitle || props.url}</Text>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[label, { lineHeight: 24 }]}>Brief description</Text>
              <TextInput {...focus("description")} accessibilityLabel="Brief description" value={props.description} onChangeText={props.onDescription} multiline placeholder="What is this link, and why will you need it?" placeholderTextColor={colors.fgTertiary} selectionColor={colors.accent} style={[input, { minHeight: 3 * 21.7 * fontScale + 22, textAlignVertical: "top", paddingTop: 10 - 2 * fontScale, paddingBottom: 10 + 2 * fontScale }, focusStyle("description")]} />
            </View>
            {error}
          </View> : <View style={{ gap: 8 }}>
            {props.clipboard !== false ? <CopiedLink appearance="web" onPaste={props.onPaste} /> : null}
            <TextInput {...focus("url")} autoFocus={props.clipboard !== false} maxFontSizeMultiplier={1.3} accessibilityLabel="Link" accessibilityHint={props.error || undefined} value={props.url} onChangeText={props.onUrl} placeholder="https://" placeholderTextColor={colors.fgTertiary} selectionColor={colors.accent} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={props.onSave} style={[input, { height: 40, paddingHorizontal: 16, paddingVertical: 0, borderRadius: radius.pill }, focusStyle("url")]} />
            {error}
          </View>}
          {confirmation ? error : null}
          <View style={{ gap: 8 }}>
            <SheetButton label={confirmation ? "Done" : "Save"} primary busy={props.busy} disabled={isPrivate && !props.description.trim()} onPress={confirmation ? props.onDone : props.onSave} />
            {!confirmation ? <SheetButton label={isPrivate ? "Cancel" : "Behind a login"} icon={isPrivate ? undefined : Lock} onPress={isPrivate ? props.onClose : props.onPrivate} /> : null}
          </View>
        </ScrollView>
        <View style={{ position: "absolute", top: 16, right: 16 }}><SheetButton label="Close" icon={X} iconOnly onPress={props.onClose} /></View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", bottom: 0, height: insets.bottom, width: "100%", maxWidth: 520, backgroundColor: colors.bgPanel }} />
    </View>
  </KeyboardAvoidingView></Modal>;
}

export function SheetButton({ label, primary, icon: Icon, iconOnly, busy, disabled, selected, onPress }: { label: string; primary?: boolean; icon?: LucideIcon; iconOnly?: boolean; busy?: boolean; disabled?: boolean; selected?: boolean; onPress: () => void }) {
  const { colors } = useWebTheme();
  const reduceMotion = useReducedMotion();
  const { focusStyle, ...focusEvents } = useControlFocus();
  const foreground = primary ? colors.accentFg : iconOnly ? colors.fgTertiary : colors.fgSecondary;
  return <Pressable {...focusEvents} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy, disabled: !!(disabled || busy), ...(selected === undefined ? {} : { selected }) }} disabled={disabled || busy} onPress={onPress} hitSlop={6}
    style={({ pressed }) => [{ minHeight: iconOnly ? 32 : 36, ...(iconOnly ? { width: 32 } : { paddingHorizontal: primary ? 18 : 14, paddingVertical: 9 }),
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: iconOnly ? 0 : 1, borderColor: selected ? colors.borderStrong : "transparent",
      borderRadius: primary ? radius.pill : radius.sm, opacity: disabled ? 0.45 : 1, backgroundColor: primary ? colors.accent : selected || pressed ? colors.bgInset : "transparent" }, focusStyle, { outlineColor: colors.focus }]}>
    {busy ? <ActivityIndicator size={14} color={foreground} animating={!reduceMotion} /> : Icon ? <Icon size={16} strokeWidth={1.7} color={foreground} /> : null}
    {!iconOnly ? <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: webSansFont(500), fontSize: 13.5, lineHeight: 13.5, color: foreground }}>{label}</Text> : null}
  </Pressable>;
}
