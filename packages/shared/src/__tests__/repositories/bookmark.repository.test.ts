import { describe, it, expect, beforeEach } from '@jest/globals';
import { BookmarkRepositoryImpl } from '../../repositories/bookmark.repository';
import { getTestDatabase } from '../../test-utils/database';
import { TestDataFactory } from '../../test-utils/factories';
import { NewBookmark } from '../../database/schema';

describe('BookmarkRepository', () => {
  let repository: BookmarkRepositoryImpl;
  let testUserId: string;

  beforeEach(() => {
    const db = getTestDatabase();
    repository = new BookmarkRepositoryImpl(db);
    testUserId = TestDataFactory.generateUserId();
  });

  describe('create', () => {
    it('should create a new bookmark', async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: 'https://example.com/unique-url',
      });

      const result = await repository.create(bookmarkData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.source_url).toBe(bookmarkData.source_url);
      expect(result.title).toBe(bookmarkData.title);
      expect(result.user_id).toBe(testUserId);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should create a bookmark with all fields', async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: 'https://example.com/full-bookmark',
        title: 'Full Test Bookmark',
        content: 'This is a full test bookmark with all fields',
        is_favorite: true,
        cosmic_summary: 'A test summary',
        cosmic_tags: ['test', 'bookmark'],
      });

      const result = await repository.create(bookmarkData);

      expect(result.title).toBe(bookmarkData.title);
      expect(result.content).toBe(bookmarkData.content);
      expect(result.is_favorite).toBe(true);
      expect(result.cosmic_summary).toBe(bookmarkData.cosmic_summary);
      expect(result.cosmic_tags).toEqual(bookmarkData.cosmic_tags);
    });
  });

  describe('findByUserAndUrl', () => {
    it('should find a bookmark by user and URL', async () => {
      const url = 'https://example.com/findable-url';
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: url,
      });

      const created = await repository.create(bookmarkData);
      const found = await repository.findByUserAndUrl(testUserId, url);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.source_url).toBe(url);
      expect(found!.user_id).toBe(testUserId);
    });

    it('should return null when bookmark is not found', async () => {
      const result = await repository.findByUserAndUrl(testUserId, 'https://nonexistent.com');
      expect(result).toBeNull();
    });

    it('should not find bookmark for different user', async () => {
      const url = 'https://example.com/private-url';
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: url,
      });

      await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();
      const found = await repository.findByUserAndUrl(otherUserId, url);

      expect(found).toBeNull();
    });
  });

  describe('findByIdAndUser', () => {
    it('should find a bookmark by ID and user', async () => {
      const bookmarkData = TestDataFactory.createBookmark({ user_id: testUserId });
      const created = await repository.create(bookmarkData);

      const found = await repository.findByIdAndUser(created.id, testUserId);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.user_id).toBe(testUserId);
    });

    it('should return null when bookmark ID is not found', async () => {
      const result = await repository.findByIdAndUser('00000000-0000-0000-0000-000000000000', testUserId);
      expect(result).toBeNull();
    });

    it('should not find bookmark for different user', async () => {
      const bookmarkData = TestDataFactory.createBookmark({ user_id: testUserId });
      const created = await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();

      const found = await repository.findByIdAndUser(created.id, otherUserId);

      expect(found).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find all bookmarks for a user', async () => {
      const bookmarks = TestDataFactory.createMultipleBookmarks(3, testUserId);

      for (const bookmark of bookmarks) {
        await repository.create(bookmark);
      }

      const found = await repository.findByUser(testUserId);

      expect(found).toHaveLength(3);
      expect(found.every(b => b.user_id === testUserId)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const bookmarks = TestDataFactory.createMultipleBookmarks(5, testUserId);

      for (const bookmark of bookmarks) {
        await repository.create(bookmark);
      }

      const found = await repository.findByUser(testUserId, { limit: 3 });

      expect(found).toHaveLength(3);
    });

    it('should respect offset parameter', async () => {
      const bookmarks = TestDataFactory.createMultipleBookmarks(5, testUserId);

      for (const bookmark of bookmarks) {
        await repository.create(bookmark);
      }

      const firstPage = await repository.findByUser(testUserId, { limit: 2, offset: 0 });
      const secondPage = await repository.findByUser(testUserId, { limit: 2, offset: 2 });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(2);
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    it('should filter by collection ID', async () => {
      // First create a collection
      const db = getTestDatabase();
      const collectionData = TestDataFactory.createCollection({ user_id: testUserId });
      const collection = await db
        .insertInto('collections')
        .values(collectionData)
        .returningAll()
        .executeTakeFirstOrThrow();

      const bookmarkInCollection = TestDataFactory.createBookmark({
        user_id: testUserId,
        collection_id: collection.id,
      });
      const bookmarkNotInCollection = TestDataFactory.createBookmark({
        user_id: testUserId,
        collection_id: null,
      });

      await repository.create(bookmarkInCollection);
      await repository.create(bookmarkNotInCollection);

      const found = await repository.findByUser(testUserId, { collectionId: collection.id });

      expect(found).toHaveLength(1);
      expect(found[0].collection_id).toBe(collection.id);
    });

    it('should exclude archived bookmarks by default', async () => {
      const archivedBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: true,
      });
      const activeBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: false,
      });

      await repository.create(archivedBookmark);
      await repository.create(activeBookmark);

      const found = await repository.findByUser(testUserId);

      expect(found).toHaveLength(1);
      expect(found[0].is_archived).toBe(false);
    });

    it('should include archived bookmarks when requested', async () => {
      const archivedBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: true,
      });
      const activeBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: false,
      });

      await repository.create(archivedBookmark);
      await repository.create(activeBookmark);

      const found = await repository.findByUser(testUserId, { includeArchived: true });

      expect(found).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update a bookmark', async () => {
      const bookmarkData = TestDataFactory.createBookmark({ user_id: testUserId });
      const created = await repository.create(bookmarkData);

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateData = {
        title: 'Updated Title',
        is_favorite: true,
        cosmic_summary: 'Updated summary',
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe(updateData.title);
      expect(updated.is_favorite).toBe(true);
      expect(updated.cosmic_summary).toBe(updateData.cosmic_summary);
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(created.updated_at.getTime());
    });

    it('should update cosmic tags and images', async () => {
      const bookmarkData = TestDataFactory.createBookmark({ user_id: testUserId });
      const created = await repository.create(bookmarkData);

      const updateData = {
        cosmic_tags: ['updated', 'tags'],
        cosmic_images: [{ url: 'https://example.com/image.jpg', description: 'Test image' }],
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.cosmic_tags).toEqual(updateData.cosmic_tags);
      expect(updated.cosmic_images).toEqual(updateData.cosmic_images);
    });
  });

  describe('delete', () => {
    it('should delete a bookmark', async () => {
      const bookmarkData = TestDataFactory.createBookmark({ user_id: testUserId });
      const created = await repository.create(bookmarkData);

      await repository.delete(created.id);

      const found = await repository.findByIdAndUser(created.id, testUserId);
      expect(found).toBeNull();
    });
  });

  describe('insertScrapedUrlContents', () => {
    it('should insert scraped URL contents', async () => {
      const bookmarkData = TestDataFactory.createBookmark({ user_id: testUserId });
      const bookmark = await repository.create(bookmarkData);

      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      // Verify the scraped content was inserted
      const db = getTestDatabase();
      const inserted = await db
        .selectFrom('scraped_url_contents')
        .selectAll()
        .where('bookmark_id', '=', bookmark.id)
        .executeTakeFirst();

      expect(inserted).toBeDefined();
      expect(inserted!.bookmark_id).toBe(bookmark.id);
      expect(inserted!.title).toBe(scrapedContent.title);
      expect(inserted!.content).toBe(scrapedContent.content);
    });
  });
});