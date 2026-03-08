import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import BookmarkDetailScreen from '../[id]';
import { BookmarksAPI } from '@/lib/api';

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
    userId: 'user-1',
    likeCount: 5,
    isLikedByCurrentUser: false,
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
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders like button with correct count', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);

    const { getByText, findByTestId } = render(<BookmarkDetailScreen />);

    // Wait for the button to appear
    const likeButton = await findByTestId('like-button');

    expect(likeButton).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('optimistically increments like count and calls like API', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);
    (BookmarksAPI.like as jest.Mock).mockResolvedValue({ likeCount: 6, isLikedByCurrentUser: true });

    const { getByText, getByTestId, findByTestId } = render(<BookmarkDetailScreen />);

    const likeButton = await findByTestId('like-button');
    expect(getByText('5')).toBeTruthy();

    fireEvent.press(likeButton);

    // Optimistically changed to 6
    expect(getByText('6')).toBeTruthy();
    expect(BookmarksAPI.like).toHaveBeenCalledWith('123');

    // Make sure unlike is not called
    expect(BookmarksAPI.unlike).not.toHaveBeenCalled();
  });

  it('optimistically decrements like count and calls unlike API when already liked', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockLikedBookmark);
    (BookmarksAPI.unlike as jest.Mock).mockResolvedValue({ likeCount: 5, isLikedByCurrentUser: false });

    const { getByText, getByTestId, findByTestId } = render(<BookmarkDetailScreen />);

    const likeButton = await findByTestId('like-button');
    expect(getByText('6')).toBeTruthy();

    fireEvent.press(likeButton);

    // Optimistically changed to 5
    expect(getByText('5')).toBeTruthy();
    expect(BookmarksAPI.unlike).toHaveBeenCalledWith('123');
  });

  it('reverts like state and shows alert when API call fails', async () => {
    (BookmarksAPI.findById as jest.Mock).mockResolvedValue(mockBookmark);
    (BookmarksAPI.like as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { getByText, getByTestId, findByTestId } = render(<BookmarkDetailScreen />);

    const likeButton = await findByTestId('like-button');
    expect(getByText('5')).toBeTruthy();

    fireEvent.press(likeButton);

    // Optimistically changed to 6
    expect(getByText('6')).toBeTruthy();

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
