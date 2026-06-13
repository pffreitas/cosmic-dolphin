import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const getWebStorage = () => {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  if (
    typeof localStorage.getItem !== 'function' ||
    typeof localStorage.setItem !== 'function' ||
    typeof localStorage.removeItem !== 'function'
  ) {
    return null;
  }

  return localStorage;
};

// Expo SecureStore adapter for Supabase auth
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      const storage = getWebStorage();
      if (storage) {
        return storage.getItem(key);
      }
      return null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      const storage = getWebStorage();
      if (storage) {
        storage.setItem(key, value);
      }
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      const storage = getWebStorage();
      if (storage) {
        storage.removeItem(key);
      }
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Debug logging for environment variables
console.log('🔧 Supabase Config:', { 
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
  keySet: !!supabaseAnonKey 
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL or Anon Key not set! Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
  },
});
