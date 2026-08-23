import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import BookmarkDetailScreen from '../[id]';
import { BookmarksAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  cacheBookmarksInBackground,
  getCachedBookmark,
  removeCachedBookmark,
} from '@/lib/bookmark-cache';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '123' }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  BookmarksAPI: {
    findById: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/bookmark-cache', () => ({
  cacheBookmarksInBackground: jest.fn(),
  getCachedBookmark: jest.fn(),
  removeCachedBookmark: jest.fn(),
}));

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockMarkdown({ children }: { children: React.ReactNode }) {
    return <Text>{children}</Text>;
  };
});

describe('BookmarkDetailScreen Like Functionality', () => {
  const mockBookmark = {
    id: '123',
    title: 'Test Bookmark',
    sourceUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user-1',
    likeCount: 5,
    isLikedByCurrentUser: false,
    isPrivateLink: false,
    isPublic: false,
    processingStatus: 'completed',
    metadata: {
      openGraph: {
        siteName: 'Example',
        description: 'Test description',
      }
    }
  };

  const mockLikedBookmark = {
    ...mockBookmark,
    likeCount: 6,
    isLikedByCurrentUser: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
    });
    (getCachedBookmark as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders like button with correct count', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);

    const { getByText, getByTestId } = render(<BookmarkDetailScreen />);

    await waitFor(() => {
      expect(getByTestId('like-button')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });
  });

  it('caches online bookmark details in the background', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);

    const { getByText } = render(<BookmarkDetailScreen />);

    await waitFor(() => expect(getByText('Test Bookmark')).toBeTruthy());

    expect(cacheBookmarksInBackground).toHaveBeenCalledWith('user-1', [mockBookmark]);
  });

  it('renders cached bookmark details when the online fetch fails', async () => {
    const cachedBookmark = {
      ...mockBookmark,
      title: 'Offline Bookmark',
    };
    (BookmarksAPI.findById as jest.Mock).mockRejectedValue(new Error('Network error'));
    (getCachedBookmark as jest.Mock).mockResolvedValue(cachedBookmark);

    const { getByText, queryByText } = render(<BookmarkDetailScreen />);

    await waitFor(() => expect(getByText('Offline Bookmark')).toBeTruthy());

    expect(queryByText('Something went wrong')).toBeNull();
  });

  it('does not render cached bookmark details when the online fetch fails with an auth error', async () => {
    const authError = Object.assign(new Error('HTTP error! status: 401'), {
      status: 401,
    });
    (BookmarksAPI.findById as jest.Mock).mockRejectedValue(authError);
    (getCachedBookmark as jest.Mock).mockResolvedValue({
      ...mockBookmark,
      title: 'Offline Bookmark',
    });

    const { getByText, queryByText } = render(<BookmarkDetailScreen />);

    await waitFor(() => expect(getByText('HTTP error! status: 401')).toBeTruthy());

    expect(queryByText('Offline Bookmark')).toBeNull();
  });

  it('removes cached details when the bookmark no longer exists online', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(null);

    const { getByText } = render(<BookmarkDetailScreen />);

    await waitFor(() => expect(getByText('Bookmark not found')).toBeTruthy());

    expect(removeCachedBookmark).toHaveBeenCalledWith('user-1', '123');
  });

  it('optimistically increments like count and calls like API', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);
    (BookmarksAPI.like as jest.Mock).mockResolvedValue({ likeCount: 6, isLikedByCurrentUser: true });

    const { getByText, findByTestId } = render(<BookmarkDetailScreen />);

    const likeButton = await findByTestId('like-button');
    expect(getByText('5')).toBeTruthy();

    await act(async () => {
      fireEvent.press(likeButton);
    });

    expect(getByText('6')).toBeTruthy();
    expect(BookmarksAPI.like).toHaveBeenCalledWith('123');

    // Make sure unlike is not called
    expect(BookmarksAPI.unlike).not.toHaveBeenCalled();
  });

  it('optimistically decrements like count and calls unlike API when already liked', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockLikedBookmark);
    (BookmarksAPI.unlike as jest.Mock).mockResolvedValue({ likeCount: 5, isLikedByCurrentUser: false });

    const { getByText, findByTestId } = render(<BookmarkDetailScreen />);

    const likeButton = await findByTestId('like-button');
    expect(getByText('6')).toBeTruthy();

    await act(async () => {
      fireEvent.press(likeButton);
    });

    expect(getByText('5')).toBeTruthy();
    expect(BookmarksAPI.unlike).toHaveBeenCalledWith('123');
  });

  it('reverts like state and shows alert when API call fails', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);
    (BookmarksAPI.like as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { getByText, findByTestId } = render(<BookmarkDetailScreen />);

    const likeButton = await findByTestId('like-button');
    expect(getByText('5')).toBeTruthy();

    await act(async () => {
      fireEvent.press(likeButton);
    });

    await waitFor(() => {
      // Reverted to 5
      expect(getByText('5')).toBeTruthy();
      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        "Failed to update like status. Please try again later.",
        [{ text: "OK" }]
      );
    });
  });
});
