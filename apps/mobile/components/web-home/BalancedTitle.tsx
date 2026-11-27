import React, { useState } from "react";
import { Text, View, useWindowDimensions, type TextStyle } from "react-native";

/** CSS text-wrap: balance adapter. Measure native glyphs rather than inserting
 * fixture-specific breaks; Dynamic Type and the actual container stay authoritative.
 * Hidden measurements keep intermediate line counts out of visible layout. */
export function BalancedTitle({ children, style, maxLines = 3 }: { children: string; style: TextStyle[]; maxLines?: number }) {
  const [width, setWidth] = useState(0);
  const [balanced, setBalanced] = useState<{ key: string; width: number }>();
  const { fontScale } = useWindowDimensions();
  const key = `${children}:${width}:${fontScale}:${JSON.stringify(style)}`;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text accessibilityRole="header" numberOfLines={maxLines || undefined} style={[...style, balanced?.key === key ? { width: balanced.width } : undefined]}>{children}</Text>
    {width > 0 ? <Measurement key={key} text={children} style={style} width={width} maxLines={maxLines || Number.POSITIVE_INFINITY} onMeasured={value => setBalanced({ key, width: value })} /> : null}
  </View>;
}
function Measurement({ text, style, width, maxLines, onMeasured }: { text: string; style: TextStyle[]; width: number; maxLines: number; onMeasured: (width: number) => void }) {
  const [search, setSearch] = useState({ candidate: width, low: 0, high: width, lines: 0, done: false });
  if (search.done) return null;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", opacity: 0 }}>
    <Text key={search.candidate} style={[...style, { width: search.candidate }]} onTextLayout={event => {
      const count = event.nativeEvent.lines.length;
      if (!count) return;
      if (!search.lines && (count === 1 || count > maxLines)) { setSearch({ ...search, done: true }); return; }
      const lines = search.lines || count;
      const low = count > lines ? search.candidate : search.low;
      const high = count <= lines ? search.candidate : search.high;
      if (high - low < 0.5) { setSearch({ ...search, done: true }); onMeasured(Math.min(width, high + 0.5)); }
      else setSearch({ candidate: (low + high) / 2, low, high, lines, done: false });
    }}>{text}</Text>
  </View>;
}
