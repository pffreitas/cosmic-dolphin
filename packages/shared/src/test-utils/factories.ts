import {
  NewBookmark,
  NewCollection,
  NewScrapedUrlContent,
} from "../database/schema";
import { BookmarkMetadata, OpenGraphMetadata } from "../types";
import { CreateTextChunkData, CreateImageChunkData } from "../repositories/content-chunk.repository";

export class TestDataFactory {
  static createCollection(
    overrides: Partial<NewCollection> = {}
  ): NewCollection {
    return {
      name: "Test Collection",
      description: "A test collection for automated testing",
      color: "#3B82F6",
      icon: "📚",
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
      title: "Test Article",
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

  static createScrapedUrlContent(
    overrides: Partial<NewScrapedUrlContent> = {}
  ): NewScrapedUrlContent {
    const metadata: BookmarkMetadata = {
      openGraph: TestDataFactory.createOpenGraphMetadata(),
      wordCount: 1200,
      readingTime: 5,
    };

    return {
      bookmark_id: crypto.randomUUID(),
      title: "Test Article",
      content: "This is the scraped content of a test article.",
      metadata,
      images: [
        { url: "https://example.com/image1.jpg", alt: "Test image 1" },
        { url: "https://example.com/image2.jpg", alt: "Test image 2" },
      ],
      links: [
        { url: "https://example.com/related-1", text: "Related article 1" },
        { url: "https://example.com/related-2", text: "Related article 2" },
      ],
      ...overrides,
    };
  }

  static createOpenGraphMetadata(
    overrides: Partial<OpenGraphMetadata> = {}
  ): OpenGraphMetadata {
    return {
      favicon: "https://example.com/favicon.ico",
      title: "Test Article Title",
      description: "This is a test article description for automated testing.",
      image: "https://example.com/og-image.jpg",
      url: "https://example.com/test-article",
      site_name: "Test Site",
      type: "article",
      locale: "en_US",
      article_author: "Test Author",
      article_published_time: "2024-01-01T00:00:00Z",
      article_modified_time: "2024-01-02T00:00:00Z",
      article_section: "Technology",
      article_tag: ["testing", "automation"],
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

  static createMultipleCollections(
    count: number,
    userId: string
  ): NewCollection[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createCollection({
        name: `Test Collection ${i + 1}`,
        user_id: userId,
      })
    );
  }

  static createMultipleBookmarks(
    count: number,
    userId: string,
    collectionId?: string
  ): NewBookmark[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createBookmark({
        source_url: TestDataFactory.generateUniqueUrl(),
        title: `Test Bookmark ${i + 1}`,
        user_id: userId,
        collection_id: collectionId || null,
      })
    );
  }

  static createTextChunk(
    overrides: Partial<CreateTextChunkData> = {}
  ): CreateTextChunkData {
    return {
      scrapedContentId: crypto.randomUUID(),
      content: "This is a test text chunk content with some meaningful text for testing purposes.",
      index: 0,
      size: 256,
      startPosition: 0,
      endPosition: 255,
      ...overrides,
    };
  }

  static createImageChunk(
    overrides: Partial<CreateImageChunkData> = {}
  ): CreateImageChunkData {
    // Create a small test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);

    return {
      scrapedContentId: crypto.randomUUID(),
      imageData: testImageBuffer,
      mimeType: "image/png",
      altText: "Test image alt text",
      originalUrl: "https://example.com/test-image.png",
      index: 0,
      size: testImageBuffer.length,
      startPosition: 0,
      endPosition: testImageBuffer.length - 1,
      ...overrides,
    };
  }

  static createMultipleTextChunks(
    count: number,
    scrapedContentId: string
  ): CreateTextChunkData[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createTextChunk({
        scrapedContentId,
        content: `Text chunk ${i + 1} content for testing purposes.`,
        index: i,
        startPosition: i * 100,
        endPosition: (i + 1) * 100 - 1,
        size: 100,
      })
    );
  }

  static createMultipleImageChunks(
    count: number,
    scrapedContentId: string
  ): CreateImageChunkData[] {
    return Array.from({ length: count }, (_, i) =>
      TestDataFactory.createImageChunk({
        scrapedContentId,
        altText: `Test image ${i + 1} alt text`,
        originalUrl: `https://example.com/test-image-${i + 1}.png`,
        index: i,
        startPosition: i * 1000,
        endPosition: (i + 1) * 1000 - 1,
      })
    );
  }

  static createMixedContentChunks(
    textCount: number,
    imageCount: number,
    scrapedContentId: string
  ): (CreateTextChunkData | CreateImageChunkData)[] {
    const chunks: (CreateTextChunkData | CreateImageChunkData)[] = [];
    let index = 0;
    let position = 0;

    // Interleave text and image chunks
    for (let i = 0; i < Math.max(textCount, imageCount); i++) {
      if (i < textCount) {
        chunks.push(TestDataFactory.createTextChunk({
          scrapedContentId,
          content: `Mixed text chunk ${i + 1} content.`,
          index: index++,
          startPosition: position,
          endPosition: position + 99,
          size: 100,
        }));
        position += 100;
      }

      if (i < imageCount) {
        chunks.push(TestDataFactory.createImageChunk({
          scrapedContentId,
          altText: `Mixed image ${i + 1} alt text`,
          originalUrl: `https://example.com/mixed-image-${i + 1}.png`,
          index: index++,
          startPosition: position,
          endPosition: position + 999,
        }));
        position += 1000;
      }
    }

    return chunks;
  }
}
