import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeToolbar, HomeTabBar } from "@/components/web-home/Chrome";
import { Copy } from "@/components/web-home/Primitives";
import { ThemePaletteScope } from "@/hooks/useTheme";
import { useWebTheme } from "@/components/web-home/theme";

export function DetailFrame({ children }: { children: React.ReactNode }) {
  const { colors } = useWebTheme();
  const [error, setError] = useState("");
  return (
    <ThemePaletteScope.Provider value="web">
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <HomeToolbar onError={setError} homeActive={false} />
        {error ? (
          <View accessibilityLiveRegion="polite" style={{ padding: 16 }}>
            <Copy style={{ color: colors.danger }}>{error}</Copy>
          </View>
        ) : null}
        {children}
        <HomeTabBar active="none" />
      </SafeAreaView>
    </ThemePaletteScope.Provider>
  );
}
