import type { TextStyle } from "react-native";
import { webColors, webTypeCompact, type WebTypeRole } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

/** Scoped web palette: other native screens keep their existing theme. */
export function useWebTheme() {
  const { scheme } = useTheme();
  return { scheme, colors: webColors[scheme] };
}
export function webText(role: WebTypeRole): TextStyle {
  const { family, fontWeight, ...style } = webTypeCompact[role];
  const weight = Number(fontWeight);
  return { ...style, includeFontPadding: false,
    fontFamily: family === "serif" ? weight >= 600 && [17, 19, 20, 28, 34].includes(style.fontSize) ? `CosmicReading${style.fontSize}` : weight >= 600 ? "SourceSerifSemibold" : "SourceSerif"
      : family === "mono" ? "SpaceMono" : weight >= 600 ? "InterSemibold" : weight >= 500 ? "InterMedium" : "Inter",
    fontWeight: "400" };
}
