import { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BookmarksAPI, UrlPreviewMetadata } from '@/lib/api';

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

// Helper to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shareIntent, resetShareIntent, hasShareIntent } = useShareIntent();
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  // Preview state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<UrlPreviewMetadata | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Extract URL from share intent - check multiple possible fields
  const sharedUrl = extractUrl(shareIntent);

  // Debug logging
  console.log('📱 Share Screen Debug:');
  console.log('  hasShareIntent:', hasShareIntent);
  console.log('  Extracted URL:', sharedUrl);

  // Fetch preview when URL is available
  useEffect(() => {
    if (sharedUrl) {
      fetchPreview(sharedUrl);
    }
  }, [sharedUrl]);

  const fetchPreview = async (url: string) => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    
    try {
      const metadata = await BookmarksAPI.preview(url);
      setPreviewData(metadata);
    } catch (error) {
      console.error('Error fetching preview:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load preview';
      setPreviewError(errorMessage);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const navigateAway = () => {
    // Reset share intent first, then navigate after a small delay
    // to ensure the intent is cleared before navigation triggers any effects
    resetShareIntent();
    
    // Use setTimeout to ensure resetShareIntent has taken effect
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 50);
  };

  const handleClose = () => {
    navigateAway();
  };

  const handleSaveAndClose = async () => {
    if (!sharedUrl) {
      navigateAway();
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await BookmarksAPI.create({ source_url: sharedUrl });
      setIsSaved(true);
      
      // Brief delay to show success state before closing
      setTimeout(() => {
        navigateAway();
      }, 500);
    } catch (error) {
      console.error('Error saving bookmark:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save bookmark';
      setSaveError(errorMessage);
      setIsSaving(false);
    }
  };

  // Get display values from preview data or fallbacks
  const displayTitle = previewData?.title || extractDomain(sharedUrl || '');
  const displayDescription = previewData?.description;
  const displayImage = previewData?.image;
  const displayFavicon = previewData?.favicon;
  const displaySiteName = previewData?.siteName || (sharedUrl ? extractDomain(sharedUrl) : '');

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={iconColor} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Save Bookmark
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
        {sharedUrl ? (
          <>
            {/* Loading state */}
            {isLoadingPreview && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={tintColor} />
                <ThemedText style={styles.loadingText}>Loading preview...</ThemedText>
              </View>
            )}

            {/* Preview Card */}
            {!isLoadingPreview && (
              <View style={styles.previewCard}>
                {/* OpenGraph Image */}
                {displayImage && (
                  <Image 
                    source={{ uri: displayImage }} 
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                )}

                {/* Card Content */}
                <View style={styles.previewContent}>
                  {/* Title */}
                  <ThemedText type="defaultSemiBold" style={styles.previewTitle} numberOfLines={2}>
                    {displayTitle}
                  </ThemedText>

                  {/* Description */}
                  {displayDescription && (
                    <ThemedText style={styles.previewDescription} numberOfLines={3}>
                      {displayDescription}
                    </ThemedText>
                  )}

                  {/* Site info */}
                  <View style={styles.siteInfo}>
                    {displayFavicon ? (
                      <Image 
                        source={{ uri: displayFavicon }} 
                        style={styles.favicon}
                      />
                    ) : (
                      <Ionicons name="globe-outline" size={16} color={iconColor} />
                    )}
                    <ThemedText style={styles.siteName} numberOfLines={1}>
                      {displaySiteName}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}

            {/* Preview error - show URL fallback */}
            {previewError && !isLoadingPreview && !previewData && (
              <View style={styles.urlFallback}>
                <Ionicons name="link" size={20} color={tintColor} />
                <ThemedText style={styles.urlFallbackText} numberOfLines={2}>
                  {sharedUrl}
                </ThemedText>
              </View>
            )}

            {/* Error message */}
            {saveError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <ThemedText style={styles.errorText}>{saveError}</ThemedText>
              </View>
            )}

            {/* Info text */}
            {!isSaved && (
              <ThemedText style={styles.infoText}>
                Tap "Save Bookmark" to add this link to your collection.
              </ThemedText>
            )}
          </>
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
      </ScrollView>

      {/* Footer Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {sharedUrl ? (
          <Pressable 
            onPress={handleSaveAndClose}
            disabled={isSaving || isSaved}
            style={({ pressed }) => [
              styles.saveButton,
              { 
                backgroundColor: isSaved ? '#22c55e' : tintColor, 
                opacity: (pressed || isSaving) ? 0.8 : 1 
              }
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : isSaved ? (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <ThemedText style={styles.saveButtonText}>Saved!</ThemedText>
              </>
            ) : (
              <>
                <Ionicons name="bookmark" size={20} color="#fff" />
                <ThemedText style={styles.saveButtonText}>Save Bookmark</ThemedText>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable 
            onPress={handleClose}
            style={({ pressed }) => [
              styles.doneButton,
              { borderColor: tintColor, opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <ThemedText style={[styles.doneButtonText, { color: tintColor }]}>
              Close
            </ThemedText>
          </Pressable>
        )}
        
        {sharedUrl && !isSaved && (
          <Pressable 
            onPress={handleClose}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.cancelButton,
              { opacity: (pressed || isSaving) ? 0.5 : 1 }
            ]}
          >
            <ThemedText style={styles.cancelButtonText}>
              Cancel
            </ThemedText>
          </Pressable>
        )}
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
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    opacity: 0.6,
    fontSize: 14,
  },
  previewCard: {
    width: '100%',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  previewContent: {
    padding: 16,
    gap: 12,
  },
  previewTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  siteName: {
    fontSize: 13,
    opacity: 0.5,
    flex: 1,
  },
  urlFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 12,
  },
  urlFallbackText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.7,
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
    marginTop: 24,
    textAlign: 'center',
    opacity: 0.5,
    fontSize: 14,
    lineHeight: 22,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
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
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    opacity: 0.6,
    fontSize: 14,
  },
});
