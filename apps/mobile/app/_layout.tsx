import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { View, ActivityIndicator, Platform } from "react-native";

import { radius } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTheme } from "@/hooks/useTheme";
import { CaptureProvider, useCaptures } from "@/contexts/CaptureContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { extractSharedUrl } from "@/lib/shareIntent";
import { androidShares, type AndroidShare } from "@/modules/share-queue";
import { saveQueue } from "@/lib/save-queue";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { scheme, colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const statusBarStyle = scheme === "dark" ? "light" : "dark";

  // React Navigation's own theme, fed from Signal so screen transitions and
  // native chrome do not flash a colour the palette does not contain.
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.bg,
      text: colors.fg,
      border: colors.border,
      notification: colors.danger,
    },
  };

  const { drain } = useCaptures();
  const segments = useSegments();
  const { hasShareIntent, shareIntent, error, resetShareIntent } = useShareIntentContext();
  const owner = useRef(session?.user.id);
  owner.current = session?.user.id;
  const bridge = androidShares();
  const consuming = useRef(false);
  const [arrival, setArrival] = useState<{ captureId?: string; noUrl?: boolean; queued?: string; error?: string }>();
  const [publicResult, setPublicResult] = useState(false);
  const [nativeReady, setNativeReady] = useState(!bridge);
  const [persisting, setPersisting] = useState(false);
  const openingShare = useRef(false);

  // Capture before resolving/auth-routing. Consume this delivery only after the
  // durable write; clearing the OS intent allows a later same-URL share.
  useEffect(() => {
    if (Platform.OS !== "android" || bridge || !hasShareIntent || consuming.current) return;
    consuming.current = true;
    setPersisting(true);
    const url = extractSharedUrl(shareIntent);
    void (async () => {
      try {
        const entry = url ? await saveQueue.enqueue({ sourceUrl: url,
          captureSource: "android_share", capturePlatform: "android" }, session?.user.id) : undefined;
        setArrival(entry ? { captureId: entry.id } : { noUrl: true });
        resetShareIntent();
        if (entry) void drain().catch(() => {});
      } catch {
        setArrival({ error: "Couldn't save on this phone. Try again." });
      } finally { setPersisting(false); }
    })();
  }, [hasShareIntent, shareIntent, resetShareIntent, session, drain, bridge]);
  useEffect(() => {
    if (!bridge) return;
    let mounted = true;
    let lane = Promise.resolve();
    const refresh = () => {
      lane = lane.then(async () => {
        setPersisting(true);
        try {
          const deliveries: AndroidShare[] = JSON.parse(await bridge.readAndroidShares());
          for (const delivery of deliveries) {
            if (mounted) setPublicResult(false);
            const url = extractSharedUrl({ text: delivery.text });
            const entry = url ? await saveQueue.enqueue({ sourceUrl: url,
              captureSource: "android_share", capturePlatform: "android" }, owner.current, delivery) : undefined;
            await bridge.removeAndroidShares([delivery.id]);
            if (mounted) setArrival(entry ? { captureId: entry.id, queued: delivery.offline ? "1" : undefined } : { noUrl: true });
            if (entry) void drain().catch(() => {});
          }
        } catch { if (mounted) setArrival({ error: "Couldn't save on this phone. Try again." }); }
        finally { if (mounted) { setPersisting(false); setNativeReady(true); } }
      });
    };
    const subscription = bridge.addListener("onAndroidShare", refresh);
    refresh();
    return () => { mounted = false; subscription.remove(); };
  }, [bridge, drain]);
  useEffect(() => { if (!hasShareIntent) consuming.current = false; }, [hasShareIntent]);

  useEffect(() => {
    if (isLoading || persisting || !nativeReady) return;
    if (arrival && (session || arrival.noUrl || arrival.error || arrival.queued)) {
      setPublicResult(!!(arrival.noUrl || arrival.error || arrival.queued));
      openingShare.current = true;
      router.replace({ pathname: "/share", params: { ...arrival, noUrl: arrival.noUrl ? "1" : undefined } });
      setArrival(undefined);
      return;
    }
    // Expo commits navigation asynchronously. Keep the auth effect from
    // overriding a result route while its durable arrival is opening.
    if (openingShare.current) {
      if (pathname === "/share") openingShare.current = false;
      return;
    }
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup && !(pathname === "/share" && publicResult)) router.replace("/(auth)/sign-in");
    else if (session && inAuthGroup && !arrival) router.replace("/(tabs)");
  }, [session, segments, isLoading, persisting, arrival, pathname, publicResult, nativeReady, router]);

  // Log any errors with share intent
  useEffect(() => {
    if (error) {
      console.error("❌ Share Intent Error:", error);
    }
  }, [error]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <>
        <StatusBar
          style={statusBarStyle}
          backgroundColor={colors.bg}
          translucent={false}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.bg,
          }}
        >
          <ActivityIndicator size="large" color={colors.accent} animating={!reduceMotion} />
        </View>
      </>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <>
        <StatusBar
          style={statusBarStyle}
          backgroundColor={colors.bg}
          translucent={false}
        />
        <Stack screenOptions={{ animation: reduceMotion ? "none" : "default" }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="bookmark/[id]"
            options={{
              headerShown: false,
              animation: reduceMotion ? "none" : "slide_from_right",
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              headerShown: false,
              presentation: "modal",
              animation: reduceMotion ? "none" : "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="share"
            options={{
              headerShown: false,
              presentation: "modal",
              animation: reduceMotion ? "none" : "slide_from_bottom",
              sheetCornerRadius: radius.lg,
            }}
          />
          <Stack.Screen
            name="save"
            options={{ headerShown: false, presentation: "modal" }}
          />
          <Stack.Screen name="topic" options={{ headerShown: false }} />
          <Stack.Screen name="collections" options={{ headerShown: false }} />
          <Stack.Screen name="reader/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Inter: require("../assets/fonts/Inter-400.ttf"),
    InterMedium: require("../assets/fonts/Inter-500.ttf"),
    InterSemibold: require("../assets/fonts/Inter-600.ttf"),
    SourceSerif: require("../assets/fonts/SourceSerif4-400.ttf"),
    SourceSerifSemibold: require("../assets/fonts/SourceSerif4-600.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <PreferencesProvider>
        <ShareIntentProvider
          options={{
            debug: false,
            resetOnBackground: true,
          }}
        >
          <CaptureProvider>
            <RootLayoutNav />
          </CaptureProvider>
        </ShareIntentProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
