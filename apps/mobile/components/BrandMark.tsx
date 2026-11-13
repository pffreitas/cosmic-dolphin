import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/constants/theme";
import { textStyle } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";

const brand = colors.light; // Brand colors are identical in both themes.
const artwork = require("@/assets/images/brand-mark.png");

/** A compact symbol on the same Plum shadow backing as the full signature. */
export function BrandMark({
  size = 36,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <Image
      source={require("@/assets/images/brand-tile.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={Boolean(title)}
      accessibilityLabel={title}
    />
  );
}

/** A single, accessible brand capsule; the wordmark is live, scalable Inter. */
export function BrandSignature({
  size = 36,
  heading = false,
  appearance,
}: {
  size?: number;
  heading?: boolean;
  appearance?: "home";
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.signature, appearance === "home" ? { backgroundColor: colors.homeHeaderBg } : styles.capsule]}
      accessible
      accessibilityRole={heading ? "header" : "image"}
      accessibilityLabel="Cosmic Dolphin"
    >
      {appearance !== "home" ? <Image
        source={require("@/assets/images/brand-gradient.png")}
        resizeMode="stretch"
        style={[
          StyleSheet.absoluteFillObject,
          { width: "100%", height: "100%" },
        ]}
        accessible={false}
      /> : null}
      <Image
        source={artwork}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessible={false}
      />
      <Text
        style={[textStyle("bodySm"), styles.name, appearance === "home" && { color: colors.homeHeaderFg }]}
        numberOfLines={appearance === "home" ? undefined : 1}
        maxFontSizeMultiplier={appearance === "home" ? 1.3 : undefined}
        accessible={false}
      >
        Cosmic Dolphin
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  signature: {
    alignSelf: "flex-start",
    flexShrink: 1,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.s1,
    paddingVertical: space.s1,
  },
  capsule: {
    paddingLeft: space.s1,
    paddingRight: space.s3,
    borderWidth: 1,
    borderRadius: radius.pill,
    borderColor: brand.brandEdge,
    backgroundColor: brand.brandBlack,
    overflow: "hidden",
  },
  name: {
    flexShrink: 1,
    color: brand.brandFg,
    fontFamily: "InterSemibold",
  },
});
