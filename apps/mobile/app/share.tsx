import { StyleSheet, View, Pressable, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

// Helper to extract URL from various share intent structures
function extractUrl(shareIntent: any): string | null {
  if (!shareIntent) return null;
  
  // Try various possible fields where URL might be stored
  const possibleUrls = [
    shareIntent.url,
    shareIntent.webUrl, 
    shareIntent.text,
    shareIntent.meta?.url,
    shareIntent.meta?.webUrl,
    shareIntent.uri,
    shareIntent.data,
  ];
  
  for (const value of possibleUrls) {
    if (typeof value === 'string' && value.length > 0) {
      // Check if it looks like a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
      }
    }
  }
  
  // If no URL found, return any text that might be there
  return shareIntent.text || shareIntent.data || null;
}

function extractTitle(shareIntent: any): string | null {
  if (!shareIntent) return null;
  return shareIntent.title || shareIntent.meta?.title || shareIntent.subject || null;
}

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shareIntent, resetShareIntent, hasShareIntent } = useShareIntent();
  
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Extract URL from share intent - check multiple possible fields
  const sharedUrl = extractUrl(shareIntent);
  const sharedTitle = extractTitle(shareIntent);

  // Debug logging - log all keys and values
  console.log('📱 Share Screen Debug:');
  console.log('  hasShareIntent:', hasShareIntent);
  console.log('  shareIntent type:', typeof shareIntent);
  console.log('  shareIntent keys:', shareIntent ? Object.keys(shareIntent) : 'null');
  console.log('  Full shareIntent:', JSON.stringify(shareIntent, null, 2));
  console.log('  Extracted URL:', sharedUrl);
  console.log('  Extracted Title:', sharedTitle);

  const handleClose = () => {
    // Reset share intent first, then navigate after a small delay
    // to ensure the intent is cleared before navigation triggers any effects
    resetShareIntent();
    
    // Use setTimeout to ensure resetShareIntent has taken effect
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 50);
  };

  const handleOpenLink = async () => {
    if (sharedUrl) {
      const canOpen = await Linking.canOpenURL(sharedUrl);
      if (canOpen) {
        await Linking.openURL(sharedUrl);
      }
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={iconColor} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Shared Link
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Dolphin Icon */}
        <View style={[styles.iconContainer, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.dolphinEmoji}>🐬</ThemedText>
        </View>

        <ThemedText type="title" style={styles.title}>
          Link Received!
        </ThemedText>

        {sharedUrl ? (
          <View style={styles.linkCard}>
            {sharedTitle && (
              <ThemedText type="defaultSemiBold" style={styles.linkTitle} numberOfLines={2}>
                {sharedTitle}
              </ThemedText>
            )}
            
            <View style={styles.urlContainer}>
              <Ionicons name="link" size={20} color={tintColor} style={styles.linkIcon} />
              <ThemedText type="link" style={styles.urlText} numberOfLines={3}>
                {sharedUrl}
              </ThemedText>
            </View>

            <Pressable 
              onPress={handleOpenLink} 
              style={({ pressed }) => [
                styles.openButton,
                { backgroundColor: tintColor, opacity: pressed ? 0.8 : 1 }
              ]}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <ThemedText style={styles.openButtonText}>Open in Browser</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={iconColor} />
            <ThemedText style={styles.emptyText}>
              No link was shared
            </ThemedText>
            {/* Debug: Show raw share intent data */}
            {shareIntent && (
              <ScrollView style={styles.debugContainer}>
                <ThemedText style={styles.debugTitle}>Debug - Raw Data:</ThemedText>
                <ThemedText style={styles.debugText}>
                  {JSON.stringify(shareIntent, null, 2)}
                </ThemedText>
              </ScrollView>
            )}
          </View>
        )}

        {/* Info text */}
        <ThemedText style={styles.infoText}>
          This link has been received by Cosmic Dolphin.{'\n'}
          Future updates will allow you to save and organize links.
        </ThemedText>
      </View>

      {/* Done Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable 
          onPress={handleClose}
          style={({ pressed }) => [
            styles.doneButton,
            { borderColor: tintColor, opacity: pressed ? 0.8 : 1 }
          ]}
        >
          <ThemedText style={[styles.doneButtonText, { color: tintColor }]}>
            Done
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.3)',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dolphinEmoji: {
    fontSize: 40,
  },
  title: {
    marginBottom: 32,
    textAlign: 'center',
  },
  linkCard: {
    width: '100%',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  linkTitle: {
    fontSize: 18,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  linkIcon: {
    marginTop: 2,
  },
  urlText: {
    flex: 1,
    fontSize: 14,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  openButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
    width: '100%',
  },
  emptyText: {
    opacity: 0.6,
  },
  debugContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 8,
    maxHeight: 200,
    width: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  debugText: {
    fontSize: 10,
    fontFamily: 'SpaceMono',
    opacity: 0.6,
  },
  infoText: {
    marginTop: 32,
    textAlign: 'center',
    opacity: 0.5,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
  },
  doneButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
