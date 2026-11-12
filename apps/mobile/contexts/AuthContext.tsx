import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Alert, AppState, Platform } from 'react-native';
import { shareKeys as defaultShareKeys } from '@/lib/share-key-client';
import type { ShareKeyManager } from '@/lib/share-key';
import { clearBookmarkCache } from '@/lib/bookmark-cache';

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
  signOutBusy: boolean;
  signOutError: string;
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

export function AuthProvider({ children, shareKeys = defaultShareKeys }: { children: React.ReactNode; shareKeys?: ShareKeyManager }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      shareKeys.activate(user.id);
      void shareKeys.ensure(user.id).catch(() => {});
    }
  }, [user?.id, shareKeys]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && user) void shareKeys.ensure(user.id).catch(() => {});
    });
    return () => listener.remove();
  }, [user?.id, shareKeys]);

  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const signOutRequest = useRef<Promise<void> | null>(null);

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
    
    let authChanged = false;
    let mounted = true;
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (authChanged || !mounted) return;
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
        authChanged = true;
        if (!mounted) return;
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
      mounted = false;
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

  // Revocation is acknowledged while the owner JWT and session still exist.
  const signOut = (): Promise<void> => {
    if (signOutRequest.current) return signOutRequest.current;
    const signedInUserId = user?.id;
    if (!signedInUserId) return Promise.resolve();
    setSignOutBusy(true);
    setSignOutError('');
    const pending = shareKeys.signOut(signedInUserId, async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
      await clearBookmarkCache(signedInUserId);
    }).catch(() => {
      setSignOutError('Connect to finish signing out');
    }).finally(() => {
      setSignOutBusy(false);
      signOutRequest.current = null;
    });
    signOutRequest.current = pending;
    return pending;
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
    signOutBusy,
    signOutError,
    sendMagicLink,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
