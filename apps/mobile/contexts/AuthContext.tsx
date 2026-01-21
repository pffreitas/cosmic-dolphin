import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';

// Required for web only
WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate the redirect URI for OAuth
  // Use the custom scheme for native apps
  const redirectTo = makeRedirectUri({
    scheme: 'cosmicdolphin',
    path: 'auth/callback',
  });
  
  console.log('🔐 Generated Redirect URI:', redirectTo);

  // Handle deep link URL and create session
  const createSessionFromUrl = async (url: string) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);

    if (errorCode) {
      console.error('OAuth error:', errorCode);
      throw new Error(errorCode);
    }

    const { access_token, refresh_token } = params;

    if (!access_token) return null;

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error('Error setting session:', error.message);
      throw error;
    }

    return data.session;
  };

  // Handle incoming deep links
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      try {
        await createSessionFromUrl(event.url);
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize auth state
  useEffect(() => {
    console.log('🔐 AuthProvider: Initializing auth state...');
    console.log('🔐 Redirect URI:', redirectTo);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🔐 AuthProvider: Got session', { 
        hasSession: !!session, 
        userEmail: session?.user?.email,
        error: error?.message 
      });
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch((error) => {
      console.error('🔐 AuthProvider: Error getting session', error);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 AuthProvider: Auth state changed', { 
          event, 
          hasSession: !!session,
          userEmail: session?.user?.email 
        });
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        if (result.type === 'success') {
          const { url } = result;
          await createSessionFromUrl(url);
        }
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Sign In Error', error.message || 'Failed to sign in with Google');
    }
  };

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Email sign in error:', error);
      Alert.alert('Sign In Error', error.message || 'Failed to sign in');
      throw error;
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      Alert.alert(
        'Verification Email Sent',
        'Please check your email to verify your account.'
      );
    } catch (error: any) {
      console.error('Email sign up error:', error);
      Alert.alert('Sign Up Error', error.message || 'Failed to sign up');
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Sign Out Error', error.message || 'Failed to sign out');
    }
  };

  // Send magic link
  const sendMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      Alert.alert(
        'Magic Link Sent',
        'Check your email for the login link.'
      );
    } catch (error: any) {
      console.error('Magic link error:', error);
      Alert.alert('Error', error.message || 'Failed to send magic link');
      throw error;
    }
  };

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    sendMagicLink,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
