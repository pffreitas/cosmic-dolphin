import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  const styles = getStyles(isDark);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {userName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{userName || 'User'}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <MenuItem
            icon="person-outline"
            title="Edit Profile"
            isDark={isDark}
            onPress={() => {}}
          />
          <MenuItem
            icon="notifications-outline"
            title="Notifications"
            isDark={isDark}
            onPress={() => {}}
          />
          <MenuItem
            icon="shield-outline"
            title="Privacy & Security"
            isDark={isDark}
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <MenuItem
            icon="color-palette-outline"
            title="Appearance"
            isDark={isDark}
            onPress={() => {}}
          />
          <MenuItem
            icon="language-outline"
            title="Language"
            isDark={isDark}
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <MenuItem
            icon="help-circle-outline"
            title="Help & FAQ"
            isDark={isDark}
            onPress={() => {}}
          />
          <MenuItem
            icon="chatbubble-outline"
            title="Contact Us"
            isDark={isDark}
            onPress={() => {}}
          />
          <MenuItem
            icon="document-text-outline"
            title="Terms & Privacy"
            isDark={isDark}
            onPress={() => {}}
          />
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>Cosmic Dolphin v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type MenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  isDark: boolean;
  onPress: () => void;
};

function MenuItem({ icon, title, isDark, onPress }: MenuItemProps) {
  const styles = getStyles(isDark);

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Ionicons
          name={icon}
          size={22}
          color={isDark ? '#9ca3af' : '#6b7280'}
        />
        <Text style={styles.menuItemTitle}>{title}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isDark ? '#6b7280' : '#9ca3af'}
      />
    </TouchableOpacity>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0a0a1a' : '#f9fafb',
    },
    scrollContent: {
      paddingBottom: 32,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
    },
    profileCard: {
      alignItems: 'center',
      paddingVertical: 24,
      marginHorizontal: 16,
      marginBottom: 24,
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    avatarContainer: {
      marginBottom: 12,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '600',
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    userName: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    menuSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#6b7280' : '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginHorizontal: 20,
      marginBottom: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 20,
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#2a2a3e' : '#f3f4f6',
    },
    menuItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    menuItemTitle: {
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 14,
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#ef4444',
    },
    signOutText: {
      fontSize: 16,
      fontWeight: '500',
      color: '#ef4444',
    },
    version: {
      textAlign: 'center',
      marginTop: 24,
      fontSize: 12,
      color: isDark ? '#4b5563' : '#9ca3af',
    },
  });
