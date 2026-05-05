import { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, ScrollView, ActivityIndicator, Image, Dimensions, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BookmarksAPI, Collection, UrlPreviewMetadata } from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types for collections
interface CollectionOption {
  id: string;
  name: string;
}

export default function PrivateLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; suggestedTags?: string; suggestedDescription?: string }>();
  const insets = useSafeAreaInsets();

  const [url, setUrl] = useState(params.url || '');
  const [description, setDescription] = useState(params.suggestedDescription || '');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [tagsGenerated, setTagsGenerated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const secondaryBackgroundColor = useThemeColor({}, 'backgroundSecondary');
  const borderColor = useThemeColor({}, 'border');

  // Load collections on mount
  useEffect(() => {
    loadCollections();
  }, []);

  // Initialize tags from URL-based suggestions if available
  useEffect(() => {
    if (params.suggestedTags) {
      try {
        const parsedTags = JSON.parse(params.suggestedTags);
        if (Array.isArray(parsedTags)) {
          setTags(parsedTags);
        }
      } catch {
        // If parsing fails, treat as plain string
        setTags([params.suggestedTags]);
      }
    }
  }, [params.suggestedTags]);

  const loadCollections = async () => {
    try {
      const collections = await BookmarksAPI.getCollections();
      setCollections(collections.map(c => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setTagsGenerated(false);
  };

  const handleGenerateTags = async () => {
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please describe what this link contains so we can generate tags for you.');
      return;
    }

    setGeneratingTags(true);

    // Simulate generation feedback
    // The actual inference happens server-side when saving
    await new Promise(resolve => setTimeout(resolve, 800));

    setGeneratingTags(false);
    setTagsGenerated(true);
  };

  const handleSave = async () => {
    if (!url) {
      Alert.alert('Error', 'URL is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await BookmarksAPI.create({
        source_url: url,
        title: title || undefined,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
        collection_id: collectionId || undefined,
        is_private_link: true,
      });

      // Navigate back to home
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error saving private link:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save private link';
      setSaveError(errorMessage);
      Alert.alert('Error', errorMessage);
      setIsSaving(false);
    }
  };

  const hasDescription = description.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <BlurView
        intensity={50}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
        tint="light"
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="close" size={24} color={tintColor} />
        </Pressable>
        <ThemedText style={styles.headerTitle} weight="bold">
          Save Private Link
        </ThemedText>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.headerButton, isSaving && { opacity: 0.5 }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={tintColor} />
          ) : (
            <ThemedText style={styles.headerButtonSave} weight="semibold">
              Save
            </ThemedText>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[styles.scrollContentInner, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* URL Display */}
        <View style={[styles.section, styles.urlSection]}>
          <ThemedText style={styles.label}>Link</ThemedText>
          <View style={[styles.urlContainer, { backgroundColor: secondaryBackgroundColor, borderColor }]}>
            <Ionicons name="link" size={16} color="#6b7280" />
            <ThemedText style={styles.urlText} numberOfLines={2} ellipsizeMode="tail">
              {url}
            </ThemedText>
          </View>
        </View>

        {/* Description - Primary Input */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>
            What is this link about?
          </ThemedText>
          <TextInput
            style={[
              styles.textarea,
              {
                backgroundColor: secondaryBackgroundColor,
                borderColor,
                color: useThemeColor({}, 'text'),
              }
            ]}
            placeholder="e.g., A tutorial on React hooks with code examples and best practices"
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <ThemedText style={styles.hint}>
            The more detail you provide, the better tags and categories we can generate.
          </ThemedText>
        </View>

        {/* Title (Optional) */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>
            Title <ThemedText style={styles.optional}>optional</ThemedText>
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: secondaryBackgroundColor,
                borderColor,
                color: useThemeColor({}, 'text'),
              }
            ]}
            placeholder="Leave blank to auto-generate from URL"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>
            Tags{' '}
            <ThemedText style={styles.optional}>
              {hasDescription ? '(generated from your description)' : '(auto-generated from URL)'}
            </ThemedText>
          </ThemedText>

          {hasDescription && !tagsGenerated && (
            <View style={styles.generateHint}>
              <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
              <ThemedText style={styles.generateHintText}>
                Tags will be generated from your description when you save
              </ThemedText>
            </View>
          )}

          {/* Generate Tags Button */}
          {hasDescription && (
            <Pressable
              onPress={handleGenerateTags}
              disabled={generatingTags}
              style={[
                styles.generateButton,
                generatingTags && styles.generateButtonDisabled,
              ]}
            >
              {generatingTags ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.generateButtonContent}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <ThemedText style={styles.generateButtonText}>
                    Generate tags from description
                  </ThemedText>
                </View>
              )}
            </Pressable>
          )}

          {tagsGenerated && (
            <View style={styles.successIndicator}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <ThemedText style={styles.successText}>Tags ready</ThemedText>
            </View>
          )}

          {/* Tags Display */}
          <View style={styles.tagsContainer}>
            {tags.map((tag) => (
              <View key={tag} style={[styles.tagChip, { backgroundColor: '#e5e7eb' }]}>
                <ThemedText style={styles.tagText}>{tag}</ThemedText>
                <Pressable onPress={() => handleRemoveTag(tag)}>
                  <Ionicons name="close" size={12} color="#6b7280" />
                </Pressable>
              </View>
            ))}
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder={tags.length === 0 ? 'Add tags...' : ''}
                placeholderTextColor="#9ca3af"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
                blurOnSubmit
              />
            </View>
          </View>
        </View>

        {/* Collection */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>Collection</ThemedText>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={tintColor} />
              <ThemedText style={styles.loadingText}>Loading collections...</ThemedText>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collectionScroll}>
              <Pressable
                onPress={() => setCollectionId('')}
                style={[
                  styles.collectionChip,
                  !collectionId && styles.collectionChipSelected,
                  { backgroundColor: secondaryBackgroundColor, borderColor },
                ]}
              >
                <ThemedText style={[styles.collectionChipText, !collectionId && styles.collectionChipTextSelected]}>
                  None
                </ThemedText>
              </Pressable>
              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  onPress={() => setCollectionId(collection.id)}
                  style={[
                    styles.collectionChip,
                    collectionId === collection.id && styles.collectionChipSelected,
                    { backgroundColor: secondaryBackgroundColor, borderColor },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.collectionChipText,
                      collectionId === collection.id && styles.collectionChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {collection.name}
                  </ThemedText>
                </Pressable>
              ))}
              {collections.length === 0 && (
                <ThemedText style={styles.noCollectionsText}>
                  No collections yet
                </ThemedText>
              )}
            </ScrollView>
          )}
        </View>

        {/* Info Banner */}
        {hasDescription && (
          <View style={styles.infoBanner}>
            <ThemedText style={styles.infoBannerText}>
              💡 Your description will be used to generate tags and categories automatically when you save.
            </ThemedText>
          </View>
        )}

        {/* Error Message */}
        {saveError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <ThemedText style={styles.errorText}>{saveError}</ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
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
    borderBottomColor: 'transparent',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    letterSpacing: -0.4,
  },
  headerButtonSave: {
    color: '#3b82f6',
    fontSize: 17,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  optional: {
    fontWeight: '400',
    color: '#9ca3af',
  },
  urlSection: {
    marginBottom: 16,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  textarea: {
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  generateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  generateHintText: {
    fontSize: 12,
    color: '#6b7280',
  },
  generateButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  successText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#f9fafb',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 13,
    color: '#374151',
  },
  tagInputContainer: {
    flex: 1,
    minWidth: 80,
  },
  tagInput: {
    fontSize: 13,
    color: '#1f2937',
    padding: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  collectionScroll: {
    maxHeight: 60,
  },
  collectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  collectionChipSelected: {
    borderColor: '#3b82f6',
    borderWidth: 1.5,
  },
  collectionChipText: {
    fontSize: 14,
    color: '#374151',
  },
  collectionChipTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  noCollectionsText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  infoBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#1e40af',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
});
