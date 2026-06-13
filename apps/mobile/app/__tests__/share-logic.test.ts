import { buildShareRoute, extractSharedUrl } from '@/lib/shareIntent';

describe('extractUrl', () => {
  it('should extract URL from raw url field', () => {
    expect(extractSharedUrl({ url: 'https://example.com' })).toBe('https://example.com');
  });

  it('should extract URL from text field', () => {
    expect(extractSharedUrl({ text: 'Check this out: https://example.com/page' })).toBe('https://example.com/page');
  });

  it('should extract URL from text field with trailing comma', () => {
    expect(extractSharedUrl({ text: 'Check this out: https://example.com/page, it is cool' })).toBe('https://example.com/page');
  });

  it('should extract URL from nested meta field', () => {
    expect(extractSharedUrl({ meta: { url: 'https://example.com' } })).toBe('https://example.com');
  });

  it('should return null if no URL found', () => {
    expect(extractSharedUrl({ text: 'No URL here' })).toBeNull();
    expect(extractSharedUrl({})).toBeNull();
    expect(extractSharedUrl(null)).toBeNull();
  });

  it('should pick the first URL if multiple exist', () => {
    expect(extractSharedUrl({ text: 'First: https://a.com, Second: https://b.com' })).toBe('https://a.com');
  });
});

describe('buildShareRoute', () => {
  it('passes the extracted URL as a stable route param', () => {
    expect(buildShareRoute({ webUrl: 'https://example.com/a?tag=one&from=share' })).toBe(
      '/share?url=https%3A%2F%2Fexample.com%2Fa%3Ftag%3Done%26from%3Dshare',
    );
  });

  it('does not open the share sheet for an empty parsed intent', () => {
    expect(
      buildShareRoute({
        files: null,
        text: null,
        webUrl: null,
        type: null,
      }),
    ).toBeNull();
  });

  it('does not open an empty share sheet for non-link text', () => {
    expect(buildShareRoute({ text: 'saved from the share sheet, but no link' })).toBeNull();
  });
});
