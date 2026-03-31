import { describe, it, expect, beforeEach } from "@jest/globals";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";

describe("BookmarkRepository", () => {
  let repository: BookmarkRepositoryImpl;
  let testUserId: string;

  beforeEach(() => {
    const db = getTestDatabase();
    repository = new BookmarkRepositoryImpl(db);
    testUserId = TestDataFactory.generateUserId();
  });

  describe("create", () => {
    it("should create a new bookmark", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: "https://example.com/unique-url",
      });

      const result = await repository.create(bookmarkData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.source_url).toBe(bookmarkData.source_url);
      expect(result.title).toBe(bookmarkData.title ?? null);
      expect(result.user_id).toBe(testUserId);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it("should create a bookmark with all fields", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: "https://example.com/full-bookmark",
        title: "Full Test Bookmark",
        is_favorite: true,
        cosmic_summary: "A test summary",
        cosmic_tags: ["test", "bookmark"],
      });

      const result = await repository.create(bookmarkData);

      expect(result.title).toBe(bookmarkData.title ?? null);
      expect(result.is_favorite).toBe(true);
      expect(result.cosmic_summary).toBe(bookmarkData.cosmic_summary ?? null);
      expect(result.cosmic_tags).toEqual(bookmarkData.cosmic_tags ?? null);
    });
  });

  describe("findByUserAndUrl", () => {
    it("should find a bookmark by user and URL", async () => {
      const url = "https://example.com/findable-url";
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: url,
      });

      const created = await repository.create(bookmarkData);
      const found = await repository.findByUserAndUrl(testUserId, url);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.source_url).toBe(url);
      expect(found!.user_id).toBe(testUserId);
    });

    it("should return null when bookmark is not found", async () => {
      const result = await repository.findByUserAndUrl(
        testUserId,
        "https://nonexistent.com"
      );
      expect(result).toBeNull();
    });

    it("should not find bookmark for different user", async () => {
      const url = "https://example.com/private-url";
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

  describe("findByIdAndUser", () => {
    it("should find a bookmark by ID and user", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      const found = await repository.findByIdAndUser(created.id, testUserId);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.user_id).toBe(testUserId);
    });

    it("should return null when bookmark ID is not found", async () => {
      const result = await repository.findByIdAndUser(
        "00000000-0000-0000-0000-000000000000",
        testUserId
      );
      expect(result).toBeNull();
    });

    it("should not find bookmark for different user", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();

      const found = await repository.findByIdAndUser(created.id, otherUserId);

      expect(found).toBeNull();
    });
  });

  describe("findByIdAndUserWithLikeStatus", () => {
    it("should return bookmark with isLikedByCurrentUser false when no like exists", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      const result = await repository.findByIdAndUserWithLikeStatus(
        created.id,
        testUserId
      );

      expect(result).not.toBeNull();
      expect(result!.bookmark.id).toBe(created.id);
      expect(result!.isLikedByCurrentUser).toBe(false);
    });

    it("should return isLikedByCurrentUser true when user has liked the bookmark", async () => {
      const db = getTestDatabase();
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      await db
        .insertInto("bookmark_likes")
        .values({ user_id: testUserId, bookmark_id: created.id })
        .execute();

      const result = await repository.findByIdAndUserWithLikeStatus(
        created.id,
        testUserId
      );

      expect(result).not.toBeNull();
      expect(result!.isLikedByCurrentUser).toBe(true);
    });

    it("should not count likes from other users", async () => {
      const db = getTestDatabase();
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();

      await db
        .insertInto("bookmark_likes")
        .values({ user_id: otherUserId, bookmark_id: created.id })
        .execute();

      const result = await repository.findByIdAndUserWithLikeStatus(
        created.id,
        testUserId
      );

      expect(result).not.toBeNull();
      expect(result!.isLikedByCurrentUser).toBe(false);
    });

    it("should return null when bookmark ID is not found", async () => {
      const result = await repository.findByIdAndUserWithLikeStatus(
        "00000000-0000-0000-0000-000000000000",
        testUserId
      );
      expect(result).toBeNull();
    });

    it("should not find bookmark for different user", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();

      const result = await repository.findByIdAndUserWithLikeStatus(
        created.id,
        otherUserId
      );

      expect(result).toBeNull();
    });
  });

  describe("findByUser", () => {
    it("should find all bookmarks for a user", async () => {
      const bookmarks = TestDataFactory.createMultipleBookmarks(3, testUserId);

      const createdIds: string[] = [];
      for (const bookmark of bookmarks) {
        const created = await repository.create(bookmark);
        createdIds.push(created.id);
      }

      const found = await repository.findByUser(testUserId);
      const foundIds = found.map((b) => b.id);

      expect(found.length).toBeGreaterThanOrEqual(3);
      expect(foundIds).toEqual(expect.arrayContaining(createdIds));
      expect(found.every((b) => b.user_id === testUserId)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const bookmarks = TestDataFactory.createMultipleBookmarks(5, testUserId);

      for (const bookmark of bookmarks) {
        await repository.create(bookmark);
      }

      const found = await repository.findByUser(testUserId, { limit: 3 });

      expect(found).toHaveLength(3);
    });

    it("should respect offset parameter", async () => {
      const bookmarks = TestDataFactory.createMultipleBookmarks(5, testUserId);

      for (const bookmark of bookmarks) {
        await repository.create(bookmark);
      }

      const firstPage = await repository.findByUser(testUserId, {
        limit: 2,
        offset: 0,
      });
      const secondPage = await repository.findByUser(testUserId, {
        limit: 2,
        offset: 2,
      });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(2);
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    it("should filter by collection ID", async () => {
      const db = getTestDatabase();
      const collectionData = TestDataFactory.createCollection({
        user_id: testUserId,
      });
      const collection = await db
        .insertInto("collections")
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

      const createdInCollection = await repository.create(bookmarkInCollection);
      await repository.create(bookmarkNotInCollection);

      const found = await repository.findByUser(testUserId, {
        collectionId: collection.id,
      });

      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.map((b) => b.id)).toContain(createdInCollection.id);
      expect(found.every((b) => b.collection_id === collection.id)).toBe(true);
    });

    it("should exclude archived bookmarks by default", async () => {
      const archivedBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: true,
      });
      const activeBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: false,
      });

      await repository.create(archivedBookmark);
      const createdActive = await repository.create(activeBookmark);

      const found = await repository.findByUser(testUserId);

      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.map((b) => b.id)).toContain(createdActive.id);
      expect(found.every((b) => b.is_archived === false)).toBe(true);
    });

    it("should include archived bookmarks when requested", async () => {
      const archivedBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: true,
      });
      const activeBookmark = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_archived: false,
      });

      const createdArchived = await repository.create(archivedBookmark);
      const createdActive = await repository.create(activeBookmark);

      const found = await repository.findByUser(testUserId, {
        includeArchived: true,
      });
      const foundIds = found.map((b) => b.id);

      expect(found.length).toBeGreaterThanOrEqual(2);
      expect(foundIds).toEqual(expect.arrayContaining([createdArchived.id, createdActive.id]));
    });
  });

  describe("update", () => {
    it("should update a bookmark", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateData = {
        title: "Updated Title",
        is_favorite: true,
        cosmic_summary: "Updated summary",
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe(updateData.title);
      expect(updated.is_favorite).toBe(true);
      expect(updated.cosmic_summary).toBe(updateData.cosmic_summary);
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(
        created.updated_at.getTime()
      );
    });

    it("should update cosmic tags and images", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      const updateData = {
        cosmic_tags: ["updated", "tags"],
        cosmic_images: [
          { url: "https://example.com/image.jpg", description: "Test image" },
        ],
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.cosmic_tags).toEqual(updateData.cosmic_tags);
      expect(updated.cosmic_images).toEqual(updateData.cosmic_images);
    });
  });

  describe("deleteByUser", () => {
    it("should delete a bookmark owned by the user and return true", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      const result = await repository.deleteByUser(created.id, testUserId);

      expect(result).toBe(true);
    });

    it("should verify the bookmark is no longer findable after deletion", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      await repository.deleteByUser(created.id, testUserId);

      const found = await repository.findByIdAndUser(created.id, testUserId);
      expect(found).toBeNull();
    });

    it("should return false when trying to delete another user's bookmark", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();

      const result = await repository.deleteByUser(created.id, otherUserId);

      expect(result).toBe(false);
    });

    it("should NOT delete the bookmark when called with wrong userId", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);
      const otherUserId = TestDataFactory.generateUserId();

      await repository.deleteByUser(created.id, otherUserId);

      const found = await repository.findByIdAndUser(created.id, testUserId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("should return false when bookmark ID does not exist", async () => {
      const result = await repository.deleteByUser(
        "00000000-0000-0000-0000-000000000000",
        testUserId
      );
      expect(result).toBe(false);
    });

    it("should return false when deleting an already-deleted bookmark", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const created = await repository.create(bookmarkData);

      await repository.deleteByUser(created.id, testUserId);
      const secondResult = await repository.deleteByUser(created.id, testUserId);

      expect(secondResult).toBe(false);
    });

    it("should cascade delete scraped_url_contents when bookmark is deleted", async () => {
      const db = getTestDatabase();
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: "Test Title",
        content: "Test content",
        metadata: { wordCount: 10, readingTime: 1 },
        images: [],
        links: [],
      });

      await repository.deleteByUser(bookmark.id, testUserId);

      const scrapedContent = await db
        .selectFrom("scraped_url_contents")
        .selectAll()
        .where("bookmark_id", "=", bookmark.id)
        .executeTakeFirst();
      expect(scrapedContent).toBeUndefined();
    });

    it("should cascade delete content_chunks and text_chunks when bookmark is deleted", async () => {
      const db = getTestDatabase();
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: "Test Title",
        content: "Test content for chunking",
        metadata: { wordCount: 20, readingTime: 1 },
        images: [],
        links: [],
      });

      const scrapedContent = await db
        .selectFrom("scraped_url_contents")
        .select("id")
        .where("bookmark_id", "=", bookmark.id)
        .executeTakeFirstOrThrow();

      const contentChunk = await db
        .insertInto("content_chunks")
        .values({
          scraped_content_id: scrapedContent.id,
          chunk_type: "text",
          index: 0,
          size: 100,
          start_position: 0,
          end_position: 99,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await db
        .insertInto("text_chunks")
        .values({
          chunk_id: contentChunk.id,
          content: "Test chunk text",
        })
        .execute();

      await repository.deleteByUser(bookmark.id, testUserId);

      const chunks = await db
        .selectFrom("content_chunks")
        .selectAll()
        .where("scraped_content_id", "=", scrapedContent.id)
        .execute();
      expect(chunks).toHaveLength(0);

      const textChunks = await db
        .selectFrom("text_chunks")
        .selectAll()
        .where("chunk_id", "=", contentChunk.id)
        .execute();
      expect(textChunks).toHaveLength(0);
    });

    it("should cascade delete bookmark_likes when bookmark is deleted", async () => {
      const db = getTestDatabase();
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      const likerUserId = TestDataFactory.generateUserId();
      await db
        .insertInto("bookmark_likes")
        .values({
          user_id: likerUserId,
          bookmark_id: bookmark.id,
        })
        .execute();

      await repository.deleteByUser(bookmark.id, testUserId);

      const likes = await db
        .selectFrom("bookmark_likes")
        .selectAll()
        .where("bookmark_id", "=", bookmark.id)
        .execute();
      expect(likes).toHaveLength(0);
    });
  });

  describe("insertScrapedUrlContents", () => {
    it("should insert scraped URL contents", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
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
        .selectFrom("scraped_url_contents")
        .selectAll()
        .where("bookmark_id", "=", bookmark.id)
        .executeTakeFirst();

      expect(inserted).toBeDefined();
      expect(inserted!.bookmark_id).toBe(bookmark.id);
      expect(inserted!.title).toBe(scrapedContent.title);
      expect(inserted!.content).toBe(scrapedContent.content);
    });
  });

  describe("getScrapedUrlContent", () => {
    it("should retrieve scraped URL content by bookmark ID", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
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

      const retrieved = await repository.getScrapedUrlContent(bookmark.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.bookmarkId).toBe(bookmark.id);
      expect(retrieved!.title).toBe(scrapedContent.title);
      expect(retrieved!.content).toBe(scrapedContent.content);
      expect(retrieved!.metadata).toEqual(scrapedContent.metadata);
      expect(retrieved!.images).toEqual(scrapedContent.images);
      expect(retrieved!.links).toEqual(scrapedContent.links);
    });

    it("should return null when scraped content does not exist", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      const retrieved = await repository.getScrapedUrlContent(bookmark.id);

      expect(retrieved).toBeNull();
    });

    it("should return null for non-existent bookmark ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const retrieved = await repository.getScrapedUrlContent(nonExistentId);

      expect(retrieved).toBeNull();
    });
  });
});
