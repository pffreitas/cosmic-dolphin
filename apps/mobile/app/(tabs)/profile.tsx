import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { textStyle } from '@/constants/fonts';
import { radius, space, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', onPress: signOut, style: 'destructive' },
      ]
    );
  };

  // Get user info from different possible sources
  const userEmail = user?.email;
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail?.split('@')[0];
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <TopBar title="Profile" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Identity */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.bgPanel, borderColor: colors.border },
          ]}
        >
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.bgInset }]}>
              <Text style={[textStyle('title1'), { color: colors.fgSecondary }]}>
                {userName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <Text style={[textStyle('title2'), { color: colors.fg }]}>{userName || 'User'}</Text>
          <Text style={[textStyle('meta'), { color: colors.fgTertiary }]}>{userEmail}</Text>
        </View>

        <Section title="Account" colors={colors}>
          <MenuItem icon="person-outline" title="Edit Profile" colors={colors} onPress={() => {}} />
          <MenuItem icon="notifications-outline" title="Notifications" colors={colors} onPress={() => {}} />
          <MenuItem icon="shield-outline" title="Privacy & Security" colors={colors} onPress={() => {}} />
        </Section>

        <Section title="Preferences" colors={colors}>
          <MenuItem icon="color-palette-outline" title="Appearance" colors={colors} onPress={() => {}} />
          <MenuItem icon="language-outline" title="Language" colors={colors} onPress={() => {}} />
        </Section>

        <Section title="Support" colors={colors}>
          <MenuItem icon="help-circle-outline" title="Help & FAQ" colors={colors} onPress={() => {}} />
          <MenuItem icon="chatbubble-outline" title="Contact Us" colors={colors} onPress={() => {}} />
          <MenuItem icon="document-text-outline" title="Terms & Privacy" colors={colors} onPress={() => {}} />
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            {
              borderColor: colors.danger,
              backgroundColor: pressed ? colors.bgInset : colors.bgPanel,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[textStyle('body'), styles.signOutText, { color: colors.danger }]}>
            Sign Out
          </Text>
        </Pressable>

        <Text style={[textStyle('meta'), styles.version, { color: colors.fgTertiary }]}>
          Cosmic Dolphin v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.menuSection}>
      <Text style={[textStyle('label'), styles.sectionTitle, { color: colors.fgTertiary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

type MenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  colors: ThemeColors;
  onPress: () => void;
};

function MenuItem({ icon, title, colors, onPress }: MenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? colors.bgSubtle : colors.bgPanel,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={20} color={colors.fgSecondary} />
        <Text style={[textStyle('body'), { color: colors.fg }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.fgTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: space.s6,
  },
  profileCard: {
    alignItems: 'center',
    gap: space.s1,
    paddingVertical: space.s5,
    marginHorizontal: space.s4,
    marginVertical: space.s5,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    marginBottom: space.s3,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSection: {
    marginBottom: space.s5,
  },
  sectionTitle: {
    marginHorizontal: space.s4,
    marginBottom: space.s2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    minHeight: 44,
    marginHorizontal: space.s4,
    paddingVertical: space.s3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutText: {
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    marginTop: space.s5,
  },
});
