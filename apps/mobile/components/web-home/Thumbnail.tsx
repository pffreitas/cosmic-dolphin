import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { radius } from "@/constants/theme";
import { useWebTheme } from "./theme";

/** Token-built fallback matches web's two radial washes and retains image geometry. */
export function Thumbnail({ uri, height = 180 }: { uri: string; height?: number }) {
  const { colors } = useWebTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View accessible={false} style={{ width: "100%", height, overflow: "hidden", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInset }}>
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <RadialGradient id="washBorder" cx="16%" cy="10%" rx="110%" ry="85%"><Stop offset="0" stopColor={colors.borderStrong} stopOpacity={0.9} /><Stop offset="0.58" stopColor={colors.borderStrong} stopOpacity={0} /></RadialGradient>
        <RadialGradient id="washInk" cx="86%" cy="90%" rx="95%" ry="95%"><Stop offset="0" stopColor={colors.fg} stopOpacity={0.14} /><Stop offset="0.56" stopColor={colors.fg} stopOpacity={0} /></RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#washBorder)" /><Rect width="100%" height="100%" fill="url(#washInk)" />
    </Svg>
    {!failed ? <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
  </View>;
}
