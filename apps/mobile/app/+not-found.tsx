import { Link, Stack, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function NotFoundScreen() {
  const router = useRouter();
  const { hasShareIntent, shareIntent } = useShareIntent();

  // If we landed here but have a share intent, redirect to share screen
  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      console.log('🔄 Redirecting from not-found to share screen');
      router.replace('/share');
    }
  }, [hasShareIntent, shareIntent]);

  // If we have a share intent, don't show the not found screen
  if (hasShareIntent && shareIntent) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">This screen doesn't exist.</ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link">Go to home screen!</ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
