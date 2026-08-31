import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';

import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface AIResponseCardProps {
  response: string;
  isStreaming: boolean;
  isLoading: boolean;
}

/**
 * The AI callout: its own quiet material — the `ai-*` ground, one hairline, a
 * 12px frame — not a second brand. Body copy is sans; the machine is talking
 * about the content, it is not the content.
 */
export function AIResponseCard({ response, isStreaming, isLoading }: AIResponseCardProps) {
  const { colors } = useTheme();

  const markdownStyles = useMemo(() => ({
    body: {
      ...textStyle('body'),
      color: colors.fg,
    },
    heading1: {
      ...textStyle('title2'),
      color: colors.fg,
      marginTop: space.s3,
      marginBottom: space.s2,
    },
    heading2: {
      ...textStyle('title3'),
      color: colors.fg,
      marginTop: space.s3,
      marginBottom: space.s1,
    },
    heading3: {
      ...textStyle('title3'),
      color: colors.fg,
      marginTop: space.s2,
      marginBottom: space.s1,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: space.s2,
    },
    link: {
      color: colors.accent,
    },
    code_inline: {
      backgroundColor: colors.bgInset,
      color: colors.fg,
      ...textStyle('bodySm'),
      paddingHorizontal: space.s1,
      paddingVertical: space.s1 / 2,
      borderRadius: radius.xs,
    },
    fence: {
      backgroundColor: colors.bgInset,
      color: colors.fg,
      ...textStyle('bodySm'),
      padding: space.s3,
      borderRadius: radius.md,
      marginVertical: space.s2,
    },
    list_item: {
      ...textStyle('body'),
      color: colors.fg,
    },
    bullet_list: {
      marginBottom: space.s2,
    },
    ordered_list: {
      marginBottom: space.s2,
    },
    strong: {
      fontWeight: '600' as const,
    },
  }), [colors]);

  if (!isLoading && !isStreaming && !response) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.aiBg, borderColor: colors.aiBorder }]}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={colors.ai} />
        <Text style={[textStyle('label'), { color: colors.ai }]}>AI Response</Text>
        {isStreaming && (
          <ActivityIndicator size="small" color={colors.ai} style={styles.spinner} />
        )}
      </View>
      <View style={styles.content}>
        {isLoading && !response ? (
          <View style={styles.skeletonContainer} accessibilityLabel="Generating an answer">
            <View style={[styles.skeletonLine, { backgroundColor: colors.bgInset, width: '100%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.bgInset, width: '90%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.bgInset, width: '75%' }]} />
          </View>
        ) : (
          <Markdown
            style={markdownStyles}
            onLinkPress={(url) => {
              Linking.openURL(url);
              return false;
            }}
          >
            {response}
          </Markdown>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: space.s4,
    marginVertical: space.s2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s1,
  },
  spinner: {
    marginLeft: space.s1,
  },
  content: {
    paddingHorizontal: space.s4,
    paddingBottom: space.s3,
  },
  skeletonContainer: {
    gap: space.s2,
    paddingTop: space.s2,
  },
  skeletonLine: {
    height: space.s3,
    borderRadius: radius.xs,
  },
});
