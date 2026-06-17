import { buildShareRoute, extractSharedUrl } from '@/lib/shareIntent';
import {
  buildPrivateLinkCreateParams,
  isPrivateLinkPreview,
} from '../../lib/private-link';
import {
  getShareScrollBottomInset,
  shouldRenderPreviewMedia,
} from '../../lib/share-layout';

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

describe('private link share helpers', () => {
  it('detects preview responses for inaccessible links', () => {
    expect(
      isPrivateLinkPreview({
        scrapable: false,
        metadata: {
          title: 'Private ticket',
          url: 'https://jira.example.com/browse/PROJ-123',
        },
      })
    ).toBe(true);
  });

  it('builds private-link create params with user context', () => {
    const params = buildPrivateLinkCreateParams({
      url: 'https://jira.example.com/browse/PROJ-123',
      preview: {
        scrapable: false,
        metadata: {
          title: 'PROJ-123',
          url: 'https://jira.example.com/browse/PROJ-123',
        },
      },
      description: 'Bug ticket for checkout retry failures',
    });

    expect(params).toEqual({
      source_url: 'https://jira.example.com/browse/PROJ-123',
      title: 'PROJ-123',
      description: 'Bug ticket for checkout retry failures',
      is_private_link: true,
    });
    expect(params).not.toHaveProperty('quick_access_hint');
  });
});

describe('share sheet layout helpers', () => {
  it('does not reserve the large preview media area for private links without images', () => {
    expect(shouldRenderPreviewMedia(true, false)).toBe(false);
    expect(shouldRenderPreviewMedia(false, false)).toBe(true);
    expect(shouldRenderPreviewMedia(true, true)).toBe(true);
  });

  it('reserves enough scroll space for the fixed footer controls', () => {
    expect(getShareScrollBottomInset(34)).toBeGreaterThanOrEqual(220);
  });
});
