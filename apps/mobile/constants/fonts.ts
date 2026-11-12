import type { TextStyle } from "react-native";
import { type, type FontRole, type TypeRole } from "@/constants/theme";

/** Bundled Signal faces, loaded before the app leaves its splash screen. */
export const fontFamily: Record<FontRole, string> = {
  sans: "Inter",
  serif: "SourceSerif",
  mono: "SpaceMono",
};
export function textStyle(role: TypeRole): TextStyle {
  const { family, fontWeight, ...rest } = type[role];
  const semibold = Number(fontWeight) >= 600;
  return {
    ...rest,
    fontFamily: semibold
      ? family === "serif"
        ? "SourceSerifSemibold"
        : family === "sans"
          ? "InterSemibold"
          : "SpaceMono"
      : fontFamily[family],
    fontWeight: "400",
  };
}
