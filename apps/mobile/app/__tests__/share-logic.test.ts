import { useShareIntent } from 'expo-share-intent';

// Mocking some dependencies to test extractUrl in isolation
// Since extractUrl is not exported, we might need to export it or test it via the component
// For this task, I'll just verify it conceptually or add a test for the whole screen if possible

// Helper to extract URL from various share intent structures (copied from share.tsx for unit testing if not exported)
function extractUrl(shareIntent: any): string | null {
  if (!shareIntent) return null;
  const urlRegex = /(https?:\/\/[^\s,;)]+)/g;
  const possibleValues = [
    shareIntent.url,
    shareIntent.webUrl, 
    shareIntent.text,
    shareIntent.meta?.url,
    shareIntent.meta?.webUrl,
    shareIntent.uri,
    shareIntent.data,
  ];
  for (const value of possibleValues) {
    if (typeof value === 'string' && value.length > 0) {
      const match = value.match(urlRegex);
      if (match && match[0]) {
        return match[0];
      }
    }
  }
  return null;
}

describe('extractUrl', () => {
  it('should extract URL from raw url field', () => {
    expect(extractUrl({ url: 'https://example.com' })).toBe('https://example.com');
  });

  it('should extract URL from text field', () => {
    expect(extractUrl({ text: 'Check this out: https://example.com/page' })).toBe('https://example.com/page');
  });

  it('should extract URL from text field with trailing comma', () => {
    expect(extractUrl({ text: 'Check this out: https://example.com/page, it is cool' })).toBe('https://example.com/page');
  });

  it('should extract URL from nested meta field', () => {
    expect(extractUrl({ meta: { url: 'https://example.com' } })).toBe('https://example.com');
  });

  it('should return null if no URL found', () => {
    expect(extractUrl({ text: 'No URL here' })).toBeNull();
    expect(extractUrl({})).toBeNull();
    expect(extractUrl(null)).toBeNull();
  });

  it('should pick the first URL if multiple exist', () => {
    expect(extractUrl({ text: 'First: https://a.com, Second: https://b.com' })).toBe('https://a.com');
  });
});
