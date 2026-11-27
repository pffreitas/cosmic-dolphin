import React, { useState } from "react";
import { Text, View, useWindowDimensions, type AccessibilityRole, type TextStyle } from "react-native";
import { useWebTheme, webText } from "./theme";

/** CSS text-wrap: pretty adapter. Leave ordinary wrapping alone; when native
 * strands a word, choose glyph-measured breaks. Save preserves a short tail;
 * sidebar copy favors even non-final lines. */
export function PrettyCopy({ children, role = "meta", style: override, maxFontSizeMultiplier = 1.3, strategy = "even", accessibilityRole }: { children: string; role?: Parameters<typeof webText>[0]; style?: TextStyle; maxFontSizeMultiplier?: number; strategy?: "even" | "short-tail"; accessibilityRole?: AccessibilityRole }) {
  const { colors } = useWebTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; width: number }>();
  const style = [
    webText(role),
    { lineHeight: 18.75, color: colors.fgTertiary },
    ...(override ? [override] : []),
  ];
  const key = `${strategy}:${maxFontSizeMultiplier}:${children}:${width}:${fontScale}:${JSON.stringify(style)}`;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Text
        accessibilityRole={accessibilityRole}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[
          ...style,
          measured?.key === key ? { width: measured.width } : undefined,
        ]}
      >
        {children}
      </Text>
      {width > 0 ? (
        <PrettyMeasurement
          key={key}
          text={children}
          style={style}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          strategy={strategy}
          width={width}
          onMeasured={(value) => setMeasured({ key, width: value })}
        />
      ) : null}
    </View>
  );
}
function PrettyMeasurement({
  text,
  style,
  maxFontSizeMultiplier,
  strategy,
  width,
  onMeasured,
}: {
  text: string;
  style: TextStyle[];
  maxFontSizeMultiplier: number;
  strategy: "even" | "short-tail";
  width: number;
  onMeasured: (width: number) => void;
}) {
  const [search, setSearch] = useState<{
    candidate: number;
    lines: number;
    done: boolean;
    best?: { width: number; score: number };
  }>({ candidate: width, lines: 0, done: false });
  if (search.done) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", opacity: 0 }}
    >
      <Text
        key={search.candidate}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[...style, { width: search.candidate }]}
        onTextLayout={(event) => {
          const lines = event.nativeEvent.lines;
          if (!lines.length) return;
          const lastWords = lines[lines.length - 1].text
            .trim()
            .split(/\s+/).length;
          if (!search.lines && (lines.length < (strategy === "short-tail" ? 2 : 3) || lastWords > 1)) {
            setSearch({ ...search, done: true });
            return;
          }
          const target = search.lines || lines.length;
          if (lines.length > target || search.candidate <= 1) {
            setSearch({ ...search, done: true });
            if (search.best) onMeasured(search.best.width);
            return;
          }
          let best = search.best;
          if (lastWords > 1 && (strategy === "even" || lastWords === 2)) {
            const widths = lines.slice(0, -1).map((line) => line.width);
            const mean =
              widths.reduce((sum, value) => sum + value, 0) / widths.length;
            const score = widths.reduce(
              (sum, value) => sum + (value - mean) ** 2,
              0,
            );
            if (!best || score < best.score)
              best = { width: search.candidate, score };
          }
          setSearch({
            candidate: search.candidate - Math.max(0.5, width / 100),
            lines: target,
            done: false,
            best,
          });
        }}
      >
        {text}
      </Text>
    </View>
  );
}
