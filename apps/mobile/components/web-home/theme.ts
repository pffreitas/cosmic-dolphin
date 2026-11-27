import { PixelRatio, Platform, useWindowDimensions, type TextStyle } from "react-native";
import { webColors, webTypeCompact, type WebTypeRole } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

/** Scoped web palette: other native screens keep their existing theme. */
export function useWebTheme() {
  const { scheme } = useTheme();
  useWindowDimensions(); // Re-select optical cuts when Dynamic Type changes.
  return { scheme, colors: webColors[scheme] };
}
export function webText(role: WebTypeRole): TextStyle {
  const { family, fontWeight, ...style } = webTypeCompact[role];
  const weight = Number(fontWeight);
  const fontScale = PixelRatio.getFontScale();
  const opticalSize = [16, 17, 19, 20, 22, 23, 26, 27, 28, 34, 38, 46].reduce((best, size) =>
    Math.abs(size - style.fontSize * fontScale) < Math.abs(best - style.fontSize * fontScale) ? size : best, 17);
  return { ...style, includeFontPadding: false,
    // iOS scales fontSize/lineHeight automatically, but tracking stays in points.
    ...("letterSpacing" in style && Platform.OS === "ios" ? { letterSpacing: style.letterSpacing * fontScale } : {}),
    // Core Text places these optical cuts above the browser line box.
    // Move glyphs only; preserve the measured line height and surrounding gaps.
    ...(Platform.OS === "ios" && (role === "edition" || role === "lead" || role === "display") ? { transform: [{ translateY: (role === "display" ? 5 : 3) * fontScale }] } : {}),
    fontFamily: family === "serif" ? weight >= 600 && [16, 17, 19, 20, 28, 34].includes(style.fontSize) ? `CosmicReading${opticalSize}` : weight >= 600 ? "SourceSerifSemibold" : "SourceSerif"
      : family === "mono" ? "SpaceMono" : weight >= 600 ? "InterSemibold" : weight >= 500 ? "InterMedium" : "Inter",
    fontWeight: "400" };
}
