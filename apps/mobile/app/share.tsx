import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

import { TopBar, TopBarAction } from '@/components/TopBar';
import { textStyle } from '@/constants/fonts';
import { motion, radius, space, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
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

/** The skeleton state. Signal's shimmer, flattened to an opacity pulse. */
function ShimmerPlaceholder({ colors }: { colors: ThemeColors }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: motion.duration * 4 }),
        withTiming(0.3, { duration: motion.duration * 4 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View
      style={[
        styles.previewCard,
        { backgroundColor: colors.bgPanel, borderColor: colors.border },
      ]}
      accessibilityLabel="Loading preview"
    >
      <Animated.View
        style={[styles.shimmerImage, { backgroundColor: colors.bgInset }, animatedStyle]}
      />
      <View style={styles.previewContent}>
        <Animated.View
          style={[styles.shimmerLine, { width: '80%', backgroundColor: colors.bgInset }, animatedStyle]}
        />
        <Animated.View
          style={[styles.shimmerLine, { width: '60%', backgroundColor: colors.bgInset }, animatedStyle]}
        />
        <Animated.View
          style={[styles.shimmerLine, { width: '40%', backgroundColor: colors.bgInset }, animatedStyle]}
        />
      </View>
    </View>
  );
}

export default function ShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const { resetShareIntent } = useShareIntentContext();
  const { colors } = useTheme();

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
    resetShareIntent();
    router.replace('/(tabs)');
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

  const isSaveDisabled = isSaving || isSaved || (isPrivateLink && !privateDescription.trim());

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.dragHandleContainer}>
        <View style={[styles.dragHandle, { backgroundColor: colors.borderStrong }]} />
      </View>

      <TopBar
        title="Save bookmark"
        actions={<TopBarAction icon="close" label="Close" onPress={handleClose} />}
      />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: getShareScrollBottomInset(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sharedUrl ? (
          <Animated.View entering={FadeInDown.duration(motion.duration)}>
            {/* A pasted link gets a real row immediately, with progress inside it. */}
            {isLoadingPreview ? (
              <ShimmerPlaceholder colors={colors} />
            ) : (
              <View
                style={[
                  styles.previewCard,
                  { backgroundColor: colors.bgPanel, borderColor: colors.border },
                ]}
              >
                {showPreviewMedia && (
                  <View style={[styles.imageContainer, { backgroundColor: colors.bgInset }]}>
                    {displayImage ? (
                      <Image
                        source={{ uri: displayImage }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="link" size={space.s7} color={colors.fgTertiary} />
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.previewContent}>
                  {/* Provenance: the source is named before anything else. */}
                  <View style={styles.siteInfo}>
                    {displayFavicon ? (
                      <Image source={{ uri: displayFavicon }} style={styles.favicon} />
                    ) : (
                      <View style={[styles.faviconPlaceholder, { backgroundColor: colors.bgInset }]}>
                        <Ionicons name="globe-outline" size={10} color={colors.fgTertiary} />
                      </View>
                    )}
                    <Text style={[textStyle('label'), { color: colors.fgTertiary }]} numberOfLines={1}>
                      {displaySiteName}
                    </Text>
                  </View>

                  {/* Title — serif: this is the content being evaluated. */}
                  <Text style={[textStyle('title2'), { color: colors.fg }]} numberOfLines={3}>
                    {displayTitle}
                  </Text>

                  {displayDescription && (
                    <Text
                      style={[textStyle('bodySm'), { color: colors.fgSecondary }]}
                      numberOfLines={4}
                    >
                      {displayDescription}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {(previewError || (!isLoadingPreview && !previewData)) && (
              <View style={[styles.urlFallback, { backgroundColor: colors.bgInset }]}>
                <Ionicons name="link" size={18} color={colors.fgTertiary} />
                <Text
                  style={[textStyle('meta'), styles.urlFallbackText, { color: colors.fgSecondary }]}
                  numberOfLines={1}
                >
                  {sharedUrl}
                </Text>
              </View>
            )}

            {isPrivateLink && (
              <View
                style={[
                  styles.privateLinkPanel,
                  { backgroundColor: colors.bgSubtle, borderColor: colors.border },
                ]}
              >
                <View style={styles.privateLinkHeader}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
                  <Text style={[textStyle('body'), styles.privateLinkTitle, { color: colors.fg }]}>
                    Save for quick access
                  </Text>
                </View>
                <Text style={[textStyle('bodySm'), { color: colors.fgSecondary }]}>
                  We cannot read or summarize this page, but we can organize it from your note.
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={[textStyle('label'), { color: colors.fgTertiary }]}>
                    Brief description
                  </Text>
                  <TextInput
                    value={privateDescription}
                    onChangeText={setPrivateDescription}
                    placeholder="What is this link, and why will you need it?"
                    placeholderTextColor={colors.fgTertiary}
                    multiline
                    style={[
                      textStyle('body'),
                      styles.textArea,
                      {
                        color: colors.fg,
                        borderColor: colors.borderStrong,
                        backgroundColor: colors.bg,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {saveError && (
              <Animated.View
                entering={FadeIn}
                accessibilityLiveRegion="polite"
                style={[
                  styles.errorContainer,
                  { backgroundColor: colors.bgInset, borderColor: colors.danger },
                ]}
              >
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={[textStyle('bodySm'), styles.errorText, { color: colors.danger }]}>
                  {saveError}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="share-outline" size={space.s8} color={colors.fgTertiary} />
            <Text style={[textStyle('bodySm'), { color: colors.fgSecondary }]}>
              Waiting for a link...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer: a hairline, not a shadow. */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + space.s5,
          },
        ]}
      >
        {sharedUrl ? (
          <View style={styles.buttonGroup}>
            <Pressable
              onPress={handleSaveAndClose}
              disabled={isSaveDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaveDisabled }}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: isSaved ? colors.success : colors.accent,
                  opacity: isSaveDisabled && !isSaved ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.accentFg} size="small" />
              ) : isSaved ? (
                <Animated.View entering={FadeIn} style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accentFg} />
                  <Text style={[textStyle('body'), styles.saveButtonText, { color: colors.accentFg }]}>
                    Saved to Library
                  </Text>
                </Animated.View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="bookmark" size={20} color={colors.accentFg} />
                  <Text style={[textStyle('body'), styles.saveButtonText, { color: colors.accentFg }]}>
                    Save Bookmark
                  </Text>
                </View>
              )}
            </Pressable>

            {!isSaved && (
              <Pressable
                onPress={handleClose}
                disabled={isSaving}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cancelButton,
                  { backgroundColor: pressed ? colors.bgInset : 'transparent' },
                ]}
              >
                <Text style={[textStyle('bodySm'), styles.cancelButtonText, { color: colors.fgSecondary }]}>
                  Maybe later
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.doneButton,
              {
                borderColor: colors.borderStrong,
                backgroundColor: pressed ? colors.bgInset : 'transparent',
              },
            ]}
          >
            <Text style={[textStyle('body'), styles.doneButtonText, { color: colors.fg }]}>
              Close
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: space.s3,
  },
  dragHandle: {
    width: space.s6,
    height: space.s1,
    borderRadius: radius.pill,
  },
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
  },
  previewCard: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
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
    padding: space.s4,
    gap: space.s2,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: radius.xs,
  },
  faviconPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  shimmerLine: {
    height: space.s4,
    borderRadius: radius.xs,
  },
  urlFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    padding: space.s3,
    borderRadius: radius.sm,
    marginTop: space.s4,
  },
  urlFallbackText: {
    flex: 1,
  },
  privateLinkPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    gap: space.s3,
    marginTop: space.s3,
    padding: space.s4,
  },
  privateLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  privateLinkTitle: {
    fontWeight: '600',
  },
  inputGroup: {
    gap: space.s2,
  },
  textArea: {
    minHeight: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    marginTop: space.s4,
    padding: space.s3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  errorText: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s4,
    paddingVertical: space.s8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  buttonGroup: {
    gap: space.s3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
  },
  saveButton: {
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.sm,
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  doneButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontWeight: '600',
  },
});
