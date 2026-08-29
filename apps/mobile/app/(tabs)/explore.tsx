import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { TopBar } from '@/components/TopBar';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function ExploreScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <TopBar title="Explore" />
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.bgInset }]}>
          <Ionicons name="compass-outline" size={space.s6} color={colors.fgTertiary} />
        </View>
        <Text style={[textStyle('title3'), { color: colors.fg }]}>Nothing to explore yet</Text>
        <Text style={[textStyle('bodySm'), styles.centered, { color: colors.fgSecondary }]}>
          Discovery lives on the web for now. Saved links stay in Home and Library.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.s6,
    gap: space.s2,
  },
  emptyIcon: {
    width: space.s8,
    height: space.s8,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.s2,
  },
});
