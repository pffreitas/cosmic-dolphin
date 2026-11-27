import React, { useState } from "react";
import { Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useWebTheme, webText } from "./theme";

/** CSS text-wrap: pretty adapter. Leave ordinary wrapping alone; when native
 * strands a word, choose glyph-measured breaks with even non-final lines. */
export function PrettyCopy({ children }: { children: string }) {
  const { colors } = useWebTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; width: number }>();
  const style = [
    webText("meta"),
    { lineHeight: 18.75, color: colors.fgTertiary },
  ];
  const key = `${children}:${width}:${fontScale}:${JSON.stringify(style)}`;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Text
        maxFontSizeMultiplier={1.3}
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
  width,
  onMeasured,
}: {
  text: string;
  style: TextStyle[];
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
        maxFontSizeMultiplier={1.3}
        style={[...style, { width: search.candidate }]}
        onTextLayout={(event) => {
          const lines = event.nativeEvent.lines;
          if (!lines.length) return;
          const lastWords = lines[lines.length - 1].text
            .trim()
            .split(/\s+/).length;
          if (!search.lines && (lines.length < 3 || lastWords > 1)) {
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
          if (lastWords > 1) {
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
