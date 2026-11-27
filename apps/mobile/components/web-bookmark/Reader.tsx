import React, { useMemo } from "react";
import {
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { radius } from "@/constants/theme";
import { openOriginal } from "@/components/BookmarkFailure";
import {
  useWebTheme,
  webSansFont,
  webText,
  webSerifFont,
  webMonoFont,
} from "@/components/web-home/theme";

/** Web ReaderProse's compact line boxes and frozen optical-size serif outlines. */
export function detailProse(size = 17, italic = false) {
  return {
    fontFamily: webSerifFont(size, 400, italic),
    fontWeight: "400" as const,
    fontSize: size,
    lineHeight: size * (italic ? 1.55 : 1.72),
    includeFontPadding: false,
  };
}
export function DetailReader({ body }: { body: string }) {
  const { colors } = useWebTheme();
  const scale = PixelRatio.getFontScale();
  const styles = useMemo(
    () => ({
      body: { ...detailProse(), color: colors.fg },
      paragraph: { marginTop: 18.7 * scale, marginBottom: 18.7 * scale },
      heading1: {
        ...detailProse(),
        color: colors.fg,
        marginTop: 0,
        marginBottom: 0,
      },
      heading5: {
        ...detailProse(),
        color: colors.fg,
        marginTop: 0,
        marginBottom: 0,
      },
      heading6: {
        ...detailProse(),
        color: colors.fg,
        marginTop: 0,
        marginBottom: 0,
      },
      heading2: {
        ...webText("readerHeading"),
        color: colors.fg,
        marginTop: 46.8 * scale,
        marginBottom: 13 * scale,
      },
      heading3: {
        ...webText("readerSubheading"),
        color: colors.fg,
        marginTop: 32 * scale,
        marginBottom: 9 * scale,
      },
      heading4: {
        fontFamily: webSansFont(600),
        fontSize: 14,
        lineHeight: 24.08,
        color: colors.fg,
        marginTop: 21 * scale,
        marginBottom: 5.6 * scale,
      },
      strong: { color: colors.fg },
      em: { fontStyle: "normal" as const },
      bullet_list: { marginVertical: 19.55 * scale },
      ordered_list: { marginVertical: 19.55 * scale },
      list_item: { marginVertical: 6.8 * scale },
      bullet_list_icon: {
        ...detailProse(),
        color: colors.fgTertiary,
        marginLeft: 3,
        marginRight: 8,
      },
      ordered_list_icon: {
        ...detailProse(),
        color: colors.fgTertiary,
        marginLeft: 0,
        marginRight: 7,
      },
      blockquote: {
        ...detailProse(21, true),
        color: colors.fgSecondary,
        borderLeftWidth: 2,
        borderLeftColor: colors.accentBorder,
        paddingLeft: 23.1,
        marginVertical: 33.6 * scale,
        backgroundColor: colors.bg,
      },
      link: { color: colors.accent, textDecorationLine: "underline" as const },
      hr: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 37.4 * scale,
      },
      code_inline: {
        ...webText("bodySm"),
        fontFamily: webMonoFont(),
        fontSize: 14.62,
        backgroundColor: colors.bgInset,
        color: colors.fg,
        borderRadius: radius.xs,
        paddingHorizontal: 4,
      },
      code_block: {
        ...webText("bodySm"),
        fontFamily: webMonoFont(),
        fontSize: 13,
        color: colors.fg,
        backgroundColor: colors.bgInset,
        padding: 16,
        borderRadius: radius.md,
        marginVertical: 25.5 * scale,
      },
      fence: {
        ...webText("bodySm"),
        fontFamily: webMonoFont(),
        fontSize: 13,
        color: colors.fg,
        backgroundColor: colors.bgInset,
        padding: 16,
        borderRadius: radius.md,
        marginVertical: 25.5 * scale,
      },
      table: { borderWidth: 0, marginVertical: 19.55 * scale },
      tr: {
        borderBottomWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
      },
      th: {
        fontFamily: webSansFont(600),
        fontSize: 14,
        lineHeight: 24.08,
        paddingHorizontal: 8,
        paddingVertical: 6,
        width: 120 * scale,
      },
      td: {
        fontFamily: webSansFont(),
        fontSize: 14,
        lineHeight: 24.08,
        paddingHorizontal: 8,
        paddingVertical: 6,
        width: 120 * scale,
      },
    }),
    [colors, scale],
  );
  const collapseBlocks = (children: React.ReactNode) => {
    let previousBottom = 0;
    const blocks = React.Children.toArray(children);
    return blocks.map((child, index) => {
      if (
        !React.isValidElement<{ style?: import("react-native").ViewStyle }>(
          child,
        )
      )
        return child;
      const style = StyleSheet.flatten(child.props.style) ?? {};
      const top =
        typeof style.marginTop === "number"
          ? style.marginTop
          : typeof style.marginVertical === "number"
            ? style.marginVertical
            : 0;
      const bottom =
        typeof style.marginBottom === "number"
          ? style.marginBottom
          : typeof style.marginVertical === "number"
            ? style.marginVertical
            : 0;
      const marginTop =
        index === 0 ? 0 : Math.max(top, previousBottom) - previousBottom;
      previousBottom = bottom;
      return React.cloneElement(child, {
        style: {
          ...style,
          marginTop,
          ...(index === blocks.length - 1 ? { marginBottom: 0 } : {}),
        },
      });
    });
  };
  return (
    <Markdown
      mergeStyle={false}
      style={styles}
      onLinkPress={(url) => {
        openOriginal(url);
        return false;
      }}
      rules={{
        // Trim only the outer block margins, as ReaderProse's first/last-child rules do.
        body: (node, children) => (
          <View key={node.key}>{collapseBlocks(children)}</View>
        ),
        blockquote: (node, children, _parents, style) => (
          <View key={node.key} style={style._VIEW_SAFE_blockquote}>
            {collapseBlocks(children)}
          </View>
        ),
        paragraph: (node, children, parents, style) => (
          <View
            key={node.key}
            style={[
              style._VIEW_SAFE_paragraph,
              parents.some((parent) => parent.type === "blockquote") && {
                marginTop: 12.6 * scale, marginBottom: 12.6 * scale,
              },
            ]}
          >
            {children}
          </View>
        ),
        ...Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((level) => [
            `heading${level}`,
            (
              node: { key: string },
              children: React.ReactNode,
              _parents: unknown,
              style: Record<string, TextStyle>,
            ) => (
              <Text
                key={node.key}
                accessibilityRole="header"
                selectable
                style={style[`heading${level}`]}
              >
                {children}
              </Text>
            ),
          ]),
        ),
        text: (node, _children, parents, _style, inherited) => {
          const sans = parents.some((parent) =>
            ["th", "td", "heading4"].includes(parent.type),
          );
          const bold = parents.some((parent) =>
            ["strong", "heading2", "heading3", "heading4", "th"].includes(
              parent.type,
            ),
          );
          const italic = parents.some((parent) =>
            ["em", "blockquote"].includes(parent.type),
          );
          return (
            <Text
              key={node.key}
              style={[
                inherited,
                {
                  fontFamily: sans
                    ? webSansFont(bold ? 600 : 400)
                    : webSerifFont(
                        inherited.fontSize ?? 17,
                        bold ? 600 : 400,
                        italic,
                      ),
                  fontWeight: "400",
                  fontStyle: sans && italic ? "italic" : "normal",
                },
              ]}
            >
              {node.content}
            </Text>
          );
        },
        code_inline: (node, _children, parents, style, inherited) => (
          <Text
            key={node.key}
            style={[
              style.code_inline,
              {
                fontSize: (inherited.fontSize ?? 17) * 0.86,
                lineHeight: inherited.lineHeight,
                fontWeight: parents.some((parent) => parent.type === "strong")
                  ? "600"
                  : "400",
              },
            ]}
          >
            {node.content}
          </Text>
        ),
        fence: (node) => (
          <ScrollView
            key={node.key}
            horizontal
            accessibilityLabel="Article code"
            style={{
              marginVertical: 25.5 * scale,
              backgroundColor: colors.bgInset,
              borderRadius: radius.md,
            }}
            contentContainerStyle={{ padding: 16 }}
          >
            <Text
              selectable
              style={{
                fontFamily: webMonoFont(),
                fontSize: 13,
                lineHeight: 29.24,
                color: colors.fg,
              }}
            >
              {node.content.replace(/\n$/, "")}
            </Text>
          </ScrollView>
        ),
        code_block: (node) => (
          <ScrollView
            key={node.key}
            horizontal
            accessibilityLabel="Article code"
            style={{
              marginVertical: 25.5 * scale,
              backgroundColor: colors.bgInset,
              borderRadius: radius.md,
            }}
            contentContainerStyle={{ padding: 16 }}
          >
            <Text
              selectable
              style={{
                fontFamily: webMonoFont(),
                fontSize: 13,
                lineHeight: 29.24,
                color: colors.fg,
              }}
            >
              {node.content.replace(/\n$/, "")}
            </Text>
          </ScrollView>
        ),
        table: (node, children) => (
          <ScrollView
            key={node.key}
            horizontal
            accessibilityLabel="Article table"
            style={{ marginVertical: 21 * scale }}
          >
            <View>{children}</View>
          </ScrollView>
        ),
        textgroup: (node, children, _parent, inherited) => (
          <Text key={node.key} selectable style={inherited.textgroup}>
            {children}
          </Text>
        ),
      }}
    >
      {body}
    </Markdown>
  );
}
