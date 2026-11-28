import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, useWindowDimensions } from "react-native";

import { colors } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const MARK_WIDTH = 144;
// The v0 master has a 462-unit inner ring in an 859-unit frame.
const MARK_OPENING = MARK_WIDTH * 462 / 859;
const HOME_REVEAL = 0.7;
const SKY_OPACITY = 0.55;

export function LaunchSplash({ ready, onFinished }: { ready: boolean; onFinished: () => void }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const transferred = useRef(false);
  const [laidOut, setLaidOut] = useState(false);
  const [markSettled, setMarkSettled] = useState(false);
  const [skyLoaded, setSkyLoaded] = useState(false);
  const [skyOpacity] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(0));

  // Transfer the native mark to React's identically sized mark after layout.
  useEffect(() => {
    if (transferred.current || !laidOut || (!markSettled && !ready)) return;
    transferred.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, [laidOut, markSettled, ready]);

  useEffect(() => {
    if (!skyLoaded) return;
    if (reducedMotion) {
      skyOpacity.setValue(SKY_OPACITY);
      return;
    }
    const reveal = Animated.timing(skyOpacity, {
      toValue: SKY_OPACITY,
      duration: 210,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
      isInteraction: false,
    });
    reveal.start();
    return () => reveal.stop();
  }, [skyLoaded, skyOpacity, reducedMotion]);

  useEffect(() => {
    if (!laidOut || !ready) return;

    const animation = Animated.timing(exit, {
      toValue: 1,
      duration: reducedMotion ? 150 : 640,
      easing: reducedMotion ? Easing.out(Easing.quad) : Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished) onFinished();
    });
    return () => animation.stop();
  }, [exit, laidOut, onFinished, ready, reducedMotion]);

  const crossfade = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const backgroundOpacity = reducedMotion ? crossfade : exit.interpolate({
    inputRange: [0, HOME_REVEAL, 1],
    outputRange: [1, 1, 0],
  });
  const markOpacity = reducedMotion ? crossfade : exit.interpolate({
    inputRange: [0, HOME_REVEAL, 0.94, 1],
    outputRange: [1, 1, 0, 0],
  });
  const revealScale = 0.85 * Math.hypot(width, height) / MARK_OPENING;
  const markScale = exit.interpolate({
    inputRange: [0, 0.24, 0.46, HOME_REVEAL, 1],
    outputRange: [1, 1.25, 2.8, revealScale, revealScale * 1.45],
  });

  return (
    <Animated.View
      testID="launch-splash"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={() => setLaidOut(true)}
      pointerEvents={ready ? "none" : "auto"}
      style={styles.overlay}
    >
      <StatusBar style="light" backgroundColor={colors.dark.brandMid} translucent={false} />
      <Animated.View style={[styles.backdrop, { opacity: backgroundOpacity }]}>
        <Animated.Image
          source={require("../assets/images/launch/milky-way.webp")}
          style={[StyleSheet.absoluteFillObject, styles.sky, { opacity: skyOpacity }]}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={() => setSkyLoaded(true)}
        />
      </Animated.View>
      <Animated.View style={{ opacity: markOpacity, transform: reducedMotion ? [] : [{ scale: markScale }] }}>
        <Image
          testID="launch-mark"
          source={require("../assets/images/launch/mark.png")}
          style={styles.mark}
          resizeMode="contain"
          resizeMethod="scale"
          fadeDuration={0}
          onLoadEnd={() => setMarkSettled(true)}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.dark.brandMid },
  sky: { width: "100%", height: "100%" },
  mark: { width: MARK_WIDTH, height: MARK_WIDTH * 695 / 859 },
});
