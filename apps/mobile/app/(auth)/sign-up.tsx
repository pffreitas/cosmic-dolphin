import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function SignUp() {
  const { signUpWithEmail, signInWithGoogle, isLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    setError('');

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSigningUp(true);
    try {
      await signUpWithEmail(email, password);
      // Navigate back to sign-in after successful signup
      router.replace('/(auth)/sign-in');
    } catch (err) {
      // Error is handled in the context
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🐬</Text>
            <Text style={[textStyle('body'), { color: colors.fgSecondary }]}>Cosmic Dolphin</Text>
          </View>

          {/* Header */}
          <Text style={[textStyle('title1'), styles.title, { color: colors.fg }]}>Create Account</Text>
          <Text style={[textStyle('bodySm'), styles.subtitle, { color: colors.fgSecondary }]}>
            Join <Text style={styles.brandText}>Cosmic Dolphin</Text> and start
            organizing your digital life.
          </Text>

          {/* Error Message */}
          {error ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.errorContainer, { backgroundColor: colors.bgInset, borderColor: colors.danger }]}
            >
              <Text style={[textStyle('bodySm'), { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[textStyle('body'), styles.input, { color: colors.fg, borderColor: colors.borderStrong, backgroundColor: colors.bg }]}
              placeholder="Email"
              placeholderTextColor={colors.fgTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[textStyle('body'), styles.input, styles.passwordInput, { color: colors.fg, borderColor: colors.borderStrong, backgroundColor: colors.bg }]}
              placeholder="Password"
              placeholderTextColor={colors.fgTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.fgTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[textStyle('body'), styles.input, styles.passwordInput, { color: colors.fg, borderColor: colors.borderStrong, backgroundColor: colors.bg }]}
              placeholder="Confirm Password"
              placeholderTextColor={colors.fgTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.fgTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpButton, { backgroundColor: colors.accent }]}
            onPress={handleSignUp}
            disabled={isSigningUp}
          >
            {isSigningUp ? (
              <ActivityIndicator color={colors.accentFg} />
            ) : (
              <Text style={[textStyle('body'), styles.signUpButtonText, { color: colors.accentFg }]}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[textStyle('meta'), styles.dividerText, { color: colors.fgTertiary }]}>
              or continue with
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialButtons}>
            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: colors.accent }]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              accessibilityLabel="Continue with Google"
            >
              <Ionicons name="logo-google" size={20} color={colors.accentFg} />
            </TouchableOpacity>

            {/* Apple Sign In (disabled for now) */}
            <TouchableOpacity
              style={[styles.socialButton, styles.disabledButton, { backgroundColor: colors.accent }]}
              disabled
              accessibilityLabel="Continue with Apple"
            >
              <Ionicons name="logo-apple" size={20} color={colors.accentFg} />
            </TouchableOpacity>

            {/* Facebook Sign In (disabled for now) */}
            <TouchableOpacity
              style={[styles.socialButton, styles.disabledButton, { backgroundColor: colors.accent }]}
              disabled
              accessibilityLabel="Continue with Facebook"
            >
              <Ionicons name="logo-facebook" size={20} color={colors.accentFg} />
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={[textStyle('bodySm'), { color: colors.fgSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
              <Text style={[textStyle('bodySm'), styles.signInLink, { color: colors.accent }]}>
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: space.s5,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.s5,
  },
  logoEmoji: {
    fontSize: 28,
    marginRight: space.s2,
  },
  title: {
    marginBottom: space.s1,
  },
  subtitle: {
    marginBottom: space.s5,
  },
  brandText: {
    fontWeight: '600',
  },
  errorContainer: {
    padding: space.s3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.s3,
  },
  inputContainer: {
    marginBottom: space.s3,
    position: 'relative',
  },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: space.s4,
  },
  passwordInput: {
    paddingRight: space.s7,
  },
  eyeButton: {
    position: 'absolute',
    right: space.s1,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButton: {
    height: 48,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.s5,
    marginTop: space.s2,
  },
  signUpButtonText: {
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.s5,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    marginHorizontal: space.s3,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.s3,
    marginBottom: space.s5,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInLink: {
    fontWeight: '600',
  },
});
