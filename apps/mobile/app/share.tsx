import { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Image, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BookmarksAPI, PreviewUrlResponse } from '@/lib/api';
import {
  buildPrivateLinkCreateParams,
  isPrivateLinkPreview,
} from '@/lib/private-link';
import {
  getShareScrollBottomInset,
  shouldRenderPreviewMedia,
} from '@/lib/share-layout';

// Helper to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function ShimmerPlaceholder() {
  const opacity = useSharedValue(0.3);
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.shimmerContainer}>
      <Animated.View style={[styles.shimmerImage, animatedStyle]} />
      <View style={styles.shimmerContent}>
        <Animated.View style={[styles.shimmerLine, { width: '80%' }, animatedStyle]} />
        <Animated.View style={[styles.shimmerLine, { width: '60%' }, animatedStyle]} />
        <Animated.View style={[styles.shimmerLine, { width: '40%' }, animatedStyle]} />
      </View>
    </View>
  );
}

export default function ShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Capture the URL once on mount from route params so it stays stable for the
  // entire lifetime of this screen, regardless of any share intent resets that
  // happen in _layout.tsx or elsewhere.
  const [sharedUrl] = useState<string | null>(() => params.url ?? null);

  // Preview state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewUrlResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [privateDescription, setPrivateDescription] = useState('');

  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const backgroundColor = useThemeColor({}, 'background');
  const secondaryBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const borderColor = useThemeColor({}, 'border');

  // Fetch preview once when the screen mounts (sharedUrl is stable)
  useEffect(() => {
    if (sharedUrl) {
      fetchPreview(sharedUrl);
    }
  }, []);

  const fetchPreview = async (url: string) => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    
    try {
      const preview = await BookmarksAPI.preview(url);
      setPreviewData(preview);
      if (isPrivateLinkPreview(preview)) {
        setPrivateDescription('');
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load preview';
      setPreviewError(errorMessage);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const navigateAway = () => {
    // Navigate immediately — do NOT reset the share intent here because that
    // clears shareIntent in the provider synchronously, causing a re-render that
    // shows the empty state while the screen is still visible. _layout.tsx owns
    // the share intent lifecycle and will reset it via its own effects.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
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
      if (isPrivateLinkPreview(previewData)) {
        if (!privateDescription.trim()) {
          setSaveError('Add a brief description so this private link is findable later.');
          setIsSaving(false);
          return;
        }

        await BookmarksAPI.create(
          buildPrivateLinkCreateParams({
            url: sharedUrl,
            preview: previewData,
            description: privateDescription,
          })
        );
      } else {
        await BookmarksAPI.create({ source_url: sharedUrl });
      }
      setIsSaved(true);

      // Brief delay to show success state before closing
      setTimeout(navigateAway, 800);
    } catch (error) {
      console.error('Error saving bookmark:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save bookmark';
      setSaveError(errorMessage);
      setIsSaving(false);
    }
  };

  // Get display values from preview data or fallbacks
  const previewMetadata = previewData?.metadata;
  const isPrivateLink = isPrivateLinkPreview(previewData);
  const displayTitle = previewMetadata?.title || extractDomain(sharedUrl || '');
  const displayDescription = previewMetadata?.description;
  const displayImage = previewMetadata?.image;
  const displayFavicon = previewMetadata?.favicon;
  const displaySiteName = previewMetadata?.siteName || (sharedUrl ? extractDomain(sharedUrl) : '');
  const showPreviewMedia = shouldRenderPreviewMedia(isPrivateLink, Boolean(displayImage));

  return (
    <ThemedView style={styles.container}>
      {/* Drag Handle for modal visual cue */}
      <View style={styles.dragHandleContainer}>
        <View style={[styles.dragHandle, { backgroundColor: borderColor }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={20}>
          <Ionicons name="close-circle" size={32} color={iconColor} style={{ opacity: 0.5 }} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Save Bookmark
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollContent} 
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: getShareScrollBottomInset(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sharedUrl ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            {/* Loading state */}
            {isLoadingPreview ? (
              <ShimmerPlaceholder />
            ) : (
              <View style={[
                styles.previewCard,
                isPrivateLink && styles.privatePreviewCard,
                { backgroundColor: secondaryBackgroundColor, borderColor },
              ]}>
                {/* OpenGraph Image with Blur Background for aspect ratio fitting */}
                {showPreviewMedia && (
                  <View style={styles.imageContainer}>
                    {displayImage ? (
                      <>
                        <Image
                          source={{ uri: displayImage }}
                          style={StyleSheet.absoluteFill}
                          blurRadius={20}
                        />
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                        <Image
                          source={{ uri: displayImage }}
                          style={styles.previewImage}
                          resizeMode="contain"
                        />
                      </>
                    ) : (
                      <View style={[styles.imagePlaceholder, { backgroundColor: borderColor }]}>
                        <Ionicons name="link" size={48} color={iconColor} style={{ opacity: 0.2 }} />
                      </View>
                    )}
                  </View>
                )}

                {/* Card Content */}
                <View style={[styles.previewContent, isPrivateLink && styles.privatePreviewContent]}>
                  {/* Site info */}
                  <View style={styles.siteInfo}>
                    {displayFavicon ? (
                      <Image 
                        source={{ uri: displayFavicon }} 
                        style={styles.favicon}
                      />
                    ) : (
                      <View style={[styles.faviconPlaceholder, { backgroundColor: borderColor }]}>
                        <Ionicons name="globe-outline" size={10} color={iconColor} />
                      </View>
                    )}
                    <ThemedText style={styles.siteName} numberOfLines={1}>
                      {displaySiteName}
                    </ThemedText>
                  </View>

                  {/* Title */}
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.previewTitle, isPrivateLink && styles.privatePreviewTitle]}
                    numberOfLines={3}
                  >
                    {displayTitle}
                  </ThemedText>

                  {/* Description */}
                  {displayDescription && (
                    <ThemedText style={styles.previewDescription} numberOfLines={4}>
                      {displayDescription}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

            {/* URL Display if preview failed or minimal */}
            {(previewError || (!isLoadingPreview && !previewData)) && (
              <View style={[styles.urlFallback, { backgroundColor: secondaryBackgroundColor }]}>
                <Ionicons name="link" size={18} color={tintColor} />
                <ThemedText style={styles.urlFallbackText} numberOfLines={1}>
                  {sharedUrl}
                </ThemedText>
              </View>
            )}

            {isPrivateLink && (
              <View style={[styles.privateLinkPanel, { backgroundColor: secondaryBackgroundColor, borderColor }]}>
                <View style={styles.privateLinkHeader}>
                  <Ionicons name="lock-closed-outline" size={18} color={tintColor} />
                  <ThemedText type="defaultSemiBold" style={styles.privateLinkTitle}>
                    Save for quick access
                  </ThemedText>
                </View>
                <ThemedText style={[styles.privateLinkCopy, { color: textSecondaryColor }]}>
                  We can't read or summarize this page, but we can organize it from your note.
                </ThemedText>
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.inputLabel, { color: textColor }]}>
                    Brief description
                  </ThemedText>
                  <TextInput
                    value={privateDescription}
                    onChangeText={setPrivateDescription}
                    placeholder="What is this link, and why will you need it?"
                    placeholderTextColor={textSecondaryColor}
                    multiline
                    style={[
                      styles.textArea,
                      {
                        color: textColor,
                        borderColor,
                        backgroundColor,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Error message */}
            {saveError && (
              <Animated.View entering={FadeIn} style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <ThemedText style={styles.errorText}>{saveError}</ThemedText>
              </Animated.View>
            )}
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="share-outline" size={64} color={iconColor} style={{ opacity: 0.2, marginBottom: 16 }} />
            <ThemedText style={styles.emptyText}>
              Waiting for a link...
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Footer Buttons - Absolute positioned at bottom */}
      <BlurView intensity={80} style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {sharedUrl ? (
          <View style={styles.buttonGroup}>
            <Pressable 
              onPress={handleSaveAndClose}
              disabled={isSaving || isSaved || (isPrivateLink && !privateDescription.trim())}
              style={({ pressed }) => [
                styles.saveButton,
                { 
                  backgroundColor: isSaved ? '#22c55e' : (isSaving ? tintColor + '80' : tintColor), 
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                }
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : isSaved ? (
                <Animated.View entering={FadeIn} style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <ThemedText style={styles.saveButtonText}>Saved to Library</ThemedText>
                </Animated.View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="bookmark" size={20} color="#fff" />
                  <ThemedText style={styles.saveButtonText}>Save Bookmark</ThemedText>
                </View>
              )}
            </Pressable>
            
            {!isSaved && (
              <Pressable 
                onPress={handleClose}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.cancelButton,
                  { opacity: pressed ? 0.6 : 1 }
                ]}
              >
                <ThemedText style={styles.cancelButtonText}>
                  Maybe later
                </ThemedText>
              </Pressable>
            )}
          </View>
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
      </BlurView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  modernCardContainer: {
    width: '100%',
    gap: 20,
  },
  previewCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  privatePreviewCard: {
    borderRadius: 20,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    padding: 20,
    gap: 8,
  },
  privatePreviewContent: {
    padding: 16,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  faviconPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteName: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  privatePreviewTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  previewDescription: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.6,
    marginTop: 4,
  },
  shimmerContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.1)',
  },
  shimmerImage: {
    width: '100%',
    height: 220,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  shimmerContent: {
    padding: 20,
    gap: 12,
  },
  shimmerLine: {
    height: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 8,
  },
  urlFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  urlFallbackText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.5,
    fontWeight: '500',
  },
  privateLinkPanel: {
    borderWidth: 1,
    borderRadius: 20,
    gap: 12,
    marginTop: 12,
    padding: 14,
  },
  privateLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privateLinkTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  privateLinkCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.4,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.1)',
  },
  buttonGroup: {
    gap: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveButton: {
    borderRadius: 20,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.4,
  },
  doneButton: {
    borderWidth: 2,
    borderRadius: 20,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontWeight: '700',
    fontSize: 17,
  },
});
