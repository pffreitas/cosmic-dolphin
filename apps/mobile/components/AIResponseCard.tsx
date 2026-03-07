import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface AIResponseCardProps {
  response: string;
  isStreaming: boolean;
  isLoading: boolean;
}

export function AIResponseCard({ response, isStreaming, isLoading }: AIResponseCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const markdownStyles = useMemo(() => ({
    body: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700' as const,
      marginTop: 12,
      marginBottom: 6,
    },
    heading2: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600' as const,
      marginTop: 10,
      marginBottom: 4,
    },
    heading3: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600' as const,
      marginTop: 8,
      marginBottom: 4,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    link: {
      color: colors.tint,
    },
    code_inline: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      fontSize: 13,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    list_item: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    strong: {
      fontWeight: '600' as const,
    },
  }), [colors]);

  if (!isLoading && !isStreaming && !response) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={colors.tint} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>AI Response</Text>
        {isStreaming && (
          <ActivityIndicator size="small" color={colors.textSecondary} style={styles.spinner} />
        )}
      </View>
      <View style={styles.content}>
        {isLoading && !response ? (
          <View style={styles.skeletonContainer}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '100%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '90%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '75%' }]} />
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
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  skeletonContainer: {
    gap: 10,
    paddingTop: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
});
