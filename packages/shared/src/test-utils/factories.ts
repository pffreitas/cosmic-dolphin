import { NewBookmark, NewCollection, NewScrapedUrlContent } from '../database/schema';
import { BookmarkMetadata, OpenGraphMetadata } from '../types';

export class TestDataFactory {
  static createCollection(overrides: Partial<NewCollection> = {}): NewCollection {
    return {
      name: 'Test Collection',
      description: 'A test collection for automated testing',
      color: '#3B82F6',
      icon: '📚',
      parent_id: null,
      user_id: crypto.randomUUID(),
      is_public: false,
      ...overrides,
    };
  }

  static createBookmark(overrides: Partial<NewBookmark> = {}): NewBookmark {
    const metadata: BookmarkMetadata = {
      openGraph: TestDataFactory.createOpenGraphMetadata(),
      wordCount: 1200,
      readingTime: 5,
    };

    return {
      source_url: TestDataFactory.generateUniqueUrl(),
      title: 'Test Article',
      content: 'This is a test article content for automated testing.',
      metadata,
      collection_id: null,
      user_id: crypto.randomUUID(),
      is_archived: false,
      is_favorite: false,
      cosmic_summary: null,
      cosmic_tags: null,
      cosmic_images: null,
      cosmic_links: null,
      ...overrides,
    };
  }

  static createScrapedUrlContent(overrides: Partial<NewScrapedUrlContent> = {}): NewScrapedUrlContent {
    const metadata: BookmarkMetadata = {
      openGraph: TestDataFactory.createOpenGraphMetadata(),
      wordCount: 1200,
      readingTime: 5,
    };

    return {
      bookmark_id: crypto.randomUUID(),
      title: 'Test Article',
      content: 'This is the scraped content of a test article.',
      metadata,
      images: [
        { url: 'https://example.com/image1.jpg', alt: 'Test image 1' },
        { url: 'https://example.com/image2.jpg', alt: 'Test image 2' },
      ],
      links: [
        { url: 'https://example.com/related-1', text: 'Related article 1' },
        { url: 'https://example.com/related-2', text: 'Related article 2' },
      ],
      ...overrides,
    };
  }

  static createOpenGraphMetadata(overrides: Partial<OpenGraphMetadata> = {}): OpenGraphMetadata {
    return {
      favicon: 'https://example.com/favicon.ico',
      title: 'Test Article Title',
      description: 'This is a test article description for automated testing.',
      image: 'https://example.com/og-image.jpg',
      url: 'https://example.com/test-article',
      site_name: 'Test Site',
      type: 'article',
      locale: 'en_US',
      article_author: 'Test Author',
      article_published_time: '2024-01-01T00:00:00Z',
      article_modified_time: '2024-01-02T00:00:00Z',
      article_section: 'Technology',
      article_tag: ['testing', 'automation'],
      ...overrides,
    };
  }

  static generateUniqueEmail(): string {
    return `test-${Math.random().toString(36).substring(7)}@example.com`;
  }

  static generateUniqueUrl(): string {
    return `https://example.com/article-${Math.random().toString(36).substring(7)}`;
  }

  static generateUserId(): string {
    return crypto.randomUUID();
  }

  static createMultipleCollections(count: number, userId: string): NewCollection[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createCollection({
        name: `Test Collection ${i + 1}`,
        user_id: userId,
      })
    );
  }

  static createMultipleBookmarks(count: number, userId: string, collectionId?: string): NewBookmark[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createBookmark({
        source_url: TestDataFactory.generateUniqueUrl(),
        title: `Test Bookmark ${i + 1}`,
        user_id: userId,
        collection_id: collectionId || null,
      })
    );
  }
}