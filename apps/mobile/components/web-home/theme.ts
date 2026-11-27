import detailInstances from "@/assets/fonts/web-detail-fonts.json";
import serifInstances from "@/assets/fonts/web-home-fonts.json";
import {
  PixelRatio,
  Platform,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { webColors, webTypeCompact, type WebTypeRole } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

/** Scoped web palette: other native screens keep their existing theme. */
const serifCuts = serifInstances.instances.map(
  (instance) => instance.opticalSize,
);

export function useWebTheme() {
  const { scheme } = useTheme();
  useWindowDimensions(); // Re-select optical cuts when Dynamic Type changes.
  return { scheme, colors: webColors[scheme] };
}
/** Exact bundled Inter weights used by web navigation/control adapters. */
export const webSansFont = (weight: 400 | 500 | 600 = 400) =>
  weight === 600 ? "InterSemibold" : weight === 500 ? "InterMedium" : "Inter";
export function webText(role: WebTypeRole): TextStyle {
  const { family, fontWeight, ...style } = webTypeCompact[role];
  const weight = Number(fontWeight);
  const fontScale = PixelRatio.getFontScale();
  const opticalSize = serifCuts.reduce(
    (best, size) =>
      Math.abs(size - style.fontSize * fontScale) <
      Math.abs(best - style.fontSize * fontScale)
        ? size
        : best,
    17,
  );
  return {
    ...style,
    includeFontPadding: false,
    // iOS scales fontSize/lineHeight automatically, but tracking stays in points.
    ...("letterSpacing" in style && Platform.OS === "ios"
      ? { letterSpacing: style.letterSpacing * fontScale }
      : {}),
    // Core Text places these optical cuts above the browser line box.
    // Move glyphs only; preserve the measured line height and surrounding gaps.
    ...(Platform.OS === "ios" &&
    (role === "edition" ||
      role === "lead" ||
      role === "display" ||
      role === "title1")
      ? {
          transform: [
            {
              translateY:
                (role === "display" ? 5 : role === "title1" ? 4 : 3) *
                fontScale,
            },
          ],
        }
      : {}),
    fontFamily:
      family === "serif"
        ? weight >= 600 &&
          [16, 17, 19, 20, 26, 28, 32, 34].includes(style.fontSize)
          ? `CosmicReading${opticalSize}`
          : weight >= 600
            ? "SourceSerifSemibold"
            : "SourceSerif"
        : family === "mono"
          ? "SpaceMono"
          : webSansFont(weight >= 600 ? 600 : weight >= 500 ? 500 : 400),
    fontWeight: "400",
  };
}

/** Native font aliases represent the canonical web family, not a component font stack. */
export function webSerifFont(
  size: number,
  weight: 400 | 600 = 400,
  italic = false,
) {
  const scaled = size * PixelRatio.getFontScale();
  const nearest = (cuts: number[]) =>
    cuts.reduce(
      (best, cut) =>
        Math.abs(cut - scaled) < Math.abs(best - scaled) ? cut : best,
      cuts[0],
    );
  if (weight === 600 && italic)
    return `CosmicBoldItalic${nearest(detailInstances.instances.filter((instance) => instance.weightAxis === 600 && instance.italic).map((instance) => instance.opticalSize))}`;
  if (weight === 600) return `CosmicReading${nearest(serifCuts)}`;
  return `Cosmic${italic ? "Italic" : "Prose"}${nearest(italic ? [17, 21, 23, 28] : [17, 23])}`;
}
// Web does not bundle IBM Plex Mono: its current Apple fallback is monospace.
export const webMonoFont = () =>
  Platform.OS === "ios" ? "Menlo" : "SpaceMono";
