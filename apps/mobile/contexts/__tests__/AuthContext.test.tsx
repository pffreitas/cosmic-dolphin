import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '@/lib/supabase';
import { clearBookmarkCache } from '@/lib/bookmark-cache';

jest.mock('@/lib/bookmark-cache', () => ({
  clearBookmarkCache: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'cosmicdolphin://auth/callback'),
}));

jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn(() => ({ params: {}, errorCode: null })),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
}));

const userId = 'user-1';

function CaptureAuth({ onValue }: { onValue: (value: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onValue(auth);
  return null;
}

describe('AuthProvider cache cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: {
            id: userId,
            email: 'user@example.com',
          },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears the signed-in user bookmark cache after sign out', async () => {
    let authValue: ReturnType<typeof useAuth> | undefined;

    render(
      <AuthProvider>
        <CaptureAuth onValue={(value) => { authValue = value; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    await act(async () => {
      await authValue!.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(clearBookmarkCache).toHaveBeenCalledWith(userId);
  });
});
