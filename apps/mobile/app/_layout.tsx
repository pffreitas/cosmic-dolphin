import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { ShareIntentProvider, useShareIntent } from 'expo-share-intent';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

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
  const hasNavigatedToShare = useRef(false);
  const { isLoading } = useAuth();

  // Handle protected routes
  useProtectedRoute();

  // Handle incoming share intents from other apps
  const { hasShareIntent, shareIntent, error } = useShareIntent({
    debug: true,
    resetOnBackground: true,
  });

  // Navigate to share screen when a link is shared
  useEffect(() => {
    // Only navigate if:
    // 1. We have a share intent with actual data
    // 2. We haven't already navigated to share screen for this intent
    // 3. We're not already on the share screen
    const isOnShareScreen = pathname === '/share';
    const hasValidIntent = hasShareIntent && shareIntent && Object.keys(shareIntent).length > 0;
    
    console.log('🔍 Share Intent Check:', { 
      hasShareIntent,
      hasValidIntent,
      pathname,
      isOnShareScreen,
      hasNavigatedToShare: hasNavigatedToShare.current 
    });
    
    if (hasValidIntent && !hasNavigatedToShare.current && !isOnShareScreen) {
      console.log('🐬 Cosmic Dolphin received a shared link!');
      console.log('📎 Share Intent Data:', JSON.stringify(shareIntent, null, 2));
      
      // Mark that we've navigated
      hasNavigatedToShare.current = true;
      
      // Navigate to the share screen to display the link
      router.replace('/share');
    }
  }, [hasShareIntent, shareIntent, pathname]);

  // Log any errors with share intent
  useEffect(() => {
    if (error) {
      console.error('❌ Share Intent Error:', error);
    }
  }, [error]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0a0a1a' : '#ffffff' }}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#ffffff' : '#111827'} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
