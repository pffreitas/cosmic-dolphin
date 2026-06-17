import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { buildShareRoute } from '@/lib/shareIntent';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function useProtectedRoute() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Debug logging
    console.log('🔐 Auth Check:', { 
      isLoading, 
      hasSession: !!session, 
      segments,
      userEmail: session?.user?.email 
    });

    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to sign-in if not authenticated and not in auth group
      console.log('🔐 Redirecting to sign-in (no session)');
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // Redirect to home if authenticated and in auth group
      console.log('🔐 Redirecting to home (has session)');
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const statusBarStyle = colorScheme === 'dark' ? 'light' : 'dark';
  const statusBarBackground = colorScheme === 'dark' ? '#00021f' : '#ffffff';
  
  // Track if we've already initiated navigation to share screen for the current intent
  const hasNavigatedToShare = useRef(false);
  const navigationInProgress = useRef(false);

  // Handle protected routes
  useProtectedRoute();

  // Handle incoming share intents from other apps
  const { hasShareIntent, shareIntent, error, resetShareIntent } = useShareIntentContext();

  // Reset navigation state when share intent is cleared
  useEffect(() => {
    if (!hasShareIntent) {
      hasNavigatedToShare.current = false;
      navigationInProgress.current = false;
    }
  }, [hasShareIntent]);

  // Navigate to share screen when a link is shared
  useEffect(() => {
    // Only navigate if:
    // 1. We have a share intent with actual data
    // 2. We haven't already navigated to share screen for this intent
    // 3. We're not already on the share screen
    // 4. Navigation is not already in progress
    const isOnShareScreen = pathname === '/share';
    const shareRoute = buildShareRoute(shareIntent);
    const hasValidIntent = hasShareIntent && !!shareRoute;
    
    console.log('🔍 Share Intent Check:', { 
      hasShareIntent,
      hasValidIntent,
      pathname,
      isOnShareScreen,
      hasNavigatedToShare: hasNavigatedToShare.current,
      navigationInProgress: navigationInProgress.current
    });
    
    if (hasShareIntent && !shareRoute) {
      console.log('Ignoring share intent without a URL');
      resetShareIntent();
      return;
    }

    if (hasValidIntent && !hasNavigatedToShare.current && !isOnShareScreen && !navigationInProgress.current) {
      // If not authenticated, the protected route will handle redirecting to sign-in.
      // Once signed in, this effect will re-run and trigger navigation.
      if (!session) return;

      console.log('🐬 Cosmic Dolphin received a shared link!');
      console.log('📎 Share Intent Data:', JSON.stringify(shareIntent, null, 2));

      // Mark that we've navigated
      hasNavigatedToShare.current = true;
      navigationInProgress.current = true;

      // Navigate to the share screen, passing the URL as a stable param so
      // share.tsx doesn't need to re-read (and race with) the share intent.
      router.replace(shareRoute as any);
    }
  }, [hasShareIntent, shareIntent, pathname, resetShareIntent, router, session]);

  // Log any errors with share intent
  useEffect(() => {
    if (error) {
      console.error('❌ Share Intent Error:', error);
    }
  }, [error]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <>
        <StatusBar style={statusBarStyle} backgroundColor={statusBarBackground} translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: statusBarBackground }}>
          <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#ffffff' : '#111827'} />
        </View>
      </>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <>
        <StatusBar style={statusBarStyle} backgroundColor={statusBarBackground} translucent={false} />
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="bookmark/[id]"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="share"
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
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
      <ShareIntentProvider
        options={{
          debug: true,
          resetOnBackground: true,
        }}
      >
        <RootLayoutNav />
      </ShareIntentProvider>
    </AuthProvider>
  );
}
