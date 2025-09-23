import { describe, it, expect, beforeEach } from "@jest/globals";
import { ContentChunkRepositoryImpl } from "../../repositories/content-chunk.repository";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";
import { TextChunk, ImageChunk } from "../../types";

describe("ContentChunkRepository", () => {
  let repository: ContentChunkRepositoryImpl;
  let bookmarkRepository: BookmarkRepositoryImpl;
  let testUserId: string;
  let testScrapedContentId: string;

  beforeEach(async () => {
    const db = getTestDatabase();
    repository = new ContentChunkRepositoryImpl(db);
    bookmarkRepository = new BookmarkRepositoryImpl(db);
    testUserId = TestDataFactory.generateUserId();

    // Create a test bookmark and scraped content for chunk association
    const bookmarkData = TestDataFactory.createBookmark({
      user_id: testUserId,
    });
    const bookmark = await bookmarkRepository.create(bookmarkData);

    const scrapedContent = TestDataFactory.createScrapedUrlContent({
      bookmark_id: bookmark.id,
    });
    await bookmarkRepository.insertScrapedUrlContents(bookmark.id, {
      title: scrapedContent.title,
      content: scrapedContent.content,
      metadata: scrapedContent.metadata,
      images: scrapedContent.images,
      links: scrapedContent.links,
    });

    const retrievedContent = await bookmarkRepository.getScrapedUrlContent(bookmark.id);
    testScrapedContentId = retrievedContent!.id;
  });

  describe("createTextChunk", () => {
    it("should create a new text chunk", async () => {
      const textChunkData = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
      });

      const result = await repository.createTextChunk(textChunkData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.chunkType).toBe("text");
      expect(result.scrapedContentId).toBe(testScrapedContentId);
      expect(result.content).toBe(textChunkData.content);
      expect(result.index).toBe(textChunkData.index);
      expect(result.size).toBe(textChunkData.size);
      expect(result.startPosition).toBe(textChunkData.startPosition);
      expect(result.endPosition).toBe(textChunkData.endPosition);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should create text chunk with custom properties", async () => {
      const textChunkData = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
        content: "Custom text content for testing",
        index: 5,
        size: 512,
        startPosition: 1000,
        endPosition: 1511,
      });

      const result = await repository.createTextChunk(textChunkData);

      expect(result.content).toBe("Custom text content for testing");
      expect(result.index).toBe(5);
      expect(result.size).toBe(512);
      expect(result.startPosition).toBe(1000);
      expect(result.endPosition).toBe(1511);
    });

    it("should handle empty text content", async () => {
      const textChunkData = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
        content: "",
      });

      const result = await repository.createTextChunk(textChunkData);

      expect(result.content).toBe("");
      expect(result.chunkType).toBe("text");
    });
  });

  describe("createImageChunk", () => {
    it("should create a new image chunk", async () => {
      const imageChunkData = TestDataFactory.createImageChunk({
        scrapedContentId: testScrapedContentId,
      });

      const result = await repository.createImageChunk(imageChunkData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.chunkType).toBe("image");
      expect(result.scrapedContentId).toBe(testScrapedContentId);
      expect(result.imageData).toEqual(imageChunkData.imageData);
      expect(result.mimeType).toBe(imageChunkData.mimeType);
      expect(result.altText).toBe(imageChunkData.altText);
      expect(result.originalUrl).toBe(imageChunkData.originalUrl);
      expect(result.index).toBe(imageChunkData.index);
      expect(result.size).toBe(imageChunkData.size);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should create image chunk without optional fields", async () => {
      const imageChunkData = TestDataFactory.createImageChunk({
        scrapedContentId: testScrapedContentId,
        altText: undefined,
        originalUrl: undefined,
      });

      const result = await repository.createImageChunk(imageChunkData);

      expect(result.mimeType).toBe("image/png");
      expect(result.altText).toBeUndefined();
      expect(result.originalUrl).toBeUndefined();
      expect(result.chunkType).toBe("image");
    });

    it("should handle different image types", async () => {
      const jpegImageData = TestDataFactory.createImageChunk({
        scrapedContentId: testScrapedContentId,
        mimeType: "image/jpeg",
        altText: "JPEG test image",
        originalUrl: "https://example.com/test.jpg",
      });

      const result = await repository.createImageChunk(jpegImageData);

      expect(result.mimeType).toBe("image/jpeg");
      expect(result.altText).toBe("JPEG test image");
      expect(result.originalUrl).toBe("https://example.com/test.jpg");
    });
  });

  describe("findByScrapedContentId", () => {
    it("should find all chunks for a scraped content", async () => {
      const textChunks = TestDataFactory.createMultipleTextChunks(2, testScrapedContentId);
      const imageChunks = TestDataFactory.createMultipleImageChunks(2, testScrapedContentId);

      // Create chunks with proper indexing
      for (let i = 0; i < textChunks.length; i++) {
        textChunks[i].index = i * 2;
        await repository.createTextChunk(textChunks[i]);
      }

      for (let i = 0; i < imageChunks.length; i++) {
        imageChunks[i].index = i * 2 + 1;
        await repository.createImageChunk(imageChunks[i]);
      }

      const found = await repository.findByScrapedContentId(testScrapedContentId);

      expect(found).toHaveLength(4);
      expect(found.filter((chunk) => chunk.chunkType === "text")).toHaveLength(2);
      expect(found.filter((chunk) => chunk.chunkType === "image")).toHaveLength(2);

      // Should be sorted by index
      for (let i = 0; i < found.length - 1; i++) {
        expect(found[i].index).toBeLessThan(found[i + 1].index);
      }
    });

    it("should return empty array when no chunks exist", async () => {
      const found = await repository.findByScrapedContentId(testScrapedContentId);
      expect(found).toHaveLength(0);
    });

    it("should return empty array for non-existent scraped content", async () => {
      const nonExistentId = TestDataFactory.generateUserId();
      const found = await repository.findByScrapedContentId(nonExistentId);
      expect(found).toHaveLength(0);
    });
  });

  describe("findTextChunksByScrapedContentId", () => {
    it("should find only text chunks", async () => {
      const textChunks = TestDataFactory.createMultipleTextChunks(3, testScrapedContentId);
      const imageChunks = TestDataFactory.createMultipleImageChunks(2, testScrapedContentId);

      for (const chunk of textChunks) {
        await repository.createTextChunk(chunk);
      }
      for (const chunk of imageChunks) {
        await repository.createImageChunk(chunk);
      }

      const found = await repository.findTextChunksByScrapedContentId(testScrapedContentId);

      expect(found).toHaveLength(3);
      expect(found.every((chunk) => chunk.chunkType === "text")).toBe(true);
      expect(found.every((chunk): chunk is TextChunk => "content" in chunk)).toBe(true);

      // Should be sorted by index
      for (let i = 0; i < found.length - 1; i++) {
        expect(found[i].index).toBeLessThan(found[i + 1].index);
      }
    });

    it("should return empty array when no text chunks exist", async () => {
      const imageChunks = TestDataFactory.createMultipleImageChunks(2, testScrapedContentId);
      for (const chunk of imageChunks) {
        await repository.createImageChunk(chunk);
      }

      const found = await repository.findTextChunksByScrapedContentId(testScrapedContentId);
      expect(found).toHaveLength(0);
    });
  });

  describe("findImageChunksByScrapedContentId", () => {
    it("should find only image chunks", async () => {
      const textChunks = TestDataFactory.createMultipleTextChunks(2, testScrapedContentId);
      const imageChunks = TestDataFactory.createMultipleImageChunks(3, testScrapedContentId);

      for (const chunk of textChunks) {
        await repository.createTextChunk(chunk);
      }
      for (const chunk of imageChunks) {
        await repository.createImageChunk(chunk);
      }

      const found = await repository.findImageChunksByScrapedContentId(testScrapedContentId);

      expect(found).toHaveLength(3);
      expect(found.every((chunk) => chunk.chunkType === "image")).toBe(true);
      expect(found.every((chunk): chunk is ImageChunk => "imageData" in chunk)).toBe(true);

      // Should be sorted by index
      for (let i = 0; i < found.length - 1; i++) {
        expect(found[i].index).toBeLessThan(found[i + 1].index);
      }
    });

    it("should return empty array when no image chunks exist", async () => {
      const textChunks = TestDataFactory.createMultipleTextChunks(2, testScrapedContentId);
      for (const chunk of textChunks) {
        await repository.createTextChunk(chunk);
      }

      const found = await repository.findImageChunksByScrapedContentId(testScrapedContentId);
      expect(found).toHaveLength(0);
    });

    it("should properly handle binary image data", async () => {
      const imageChunk = TestDataFactory.createImageChunk({
        scrapedContentId: testScrapedContentId,
      });
      await repository.createImageChunk(imageChunk);

      const found = await repository.findImageChunksByScrapedContentId(testScrapedContentId);

      expect(found).toHaveLength(1);
      expect(Buffer.isBuffer(found[0].imageData)).toBe(true);
      expect(found[0].imageData).toEqual(imageChunk.imageData);
    });
  });

  describe("findById", () => {
    it("should find text chunk by ID", async () => {
      const textChunkData = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
      });
      const created = await repository.createTextChunk(textChunkData);

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.chunkType).toBe("text");
      expect((found as TextChunk).content).toBe(textChunkData.content);
    });

    it("should find image chunk by ID", async () => {
      const imageChunkData = TestDataFactory.createImageChunk({
        scrapedContentId: testScrapedContentId,
      });
      const created = await repository.createImageChunk(imageChunkData);

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.chunkType).toBe("image");
      expect((found as ImageChunk).imageData).toEqual(imageChunkData.imageData);
      expect((found as ImageChunk).mimeType).toBe(imageChunkData.mimeType);
    });

    it("should return null when chunk ID is not found", async () => {
      const nonExistentId = TestDataFactory.generateUserId();
      const found = await repository.findById(nonExistentId);
      expect(found).toBeNull();
    });
  });

  describe("deleteByScrapedContentId", () => {
    it("should delete all chunks for a scraped content", async () => {
      const textChunks = TestDataFactory.createMultipleTextChunks(2, testScrapedContentId);
      const imageChunks = TestDataFactory.createMultipleImageChunks(2, testScrapedContentId);

      const createdText = [];
      const createdImages = [];

      for (const chunk of textChunks) {
        createdText.push(await repository.createTextChunk(chunk));
      }
      for (const chunk of imageChunks) {
        createdImages.push(await repository.createImageChunk(chunk));
      }

      await repository.deleteByScrapedContentId(testScrapedContentId);

      // Verify all chunks are deleted
      const found = await repository.findByScrapedContentId(testScrapedContentId);
      expect(found).toHaveLength(0);

      // Verify individual chunks are not found
      for (const chunk of [...createdText, ...createdImages]) {
        const foundChunk = await repository.findById(chunk.id);
        expect(foundChunk).toBeNull();
      }
    });

    it("should not affect chunks from other scraped contents", async () => {
      // Create another test scraped content
      const bookmarkData2 = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark2 = await bookmarkRepository.create(bookmarkData2);
      const scrapedContent2 = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark2.id,
      });
      await bookmarkRepository.insertScrapedUrlContents(bookmark2.id, {
        title: scrapedContent2.title,
        content: scrapedContent2.content,
        metadata: scrapedContent2.metadata,
        images: scrapedContent2.images,
        links: scrapedContent2.links,
      });
      const retrievedContent2 = await bookmarkRepository.getScrapedUrlContent(bookmark2.id);
      const testScrapedContentId2 = retrievedContent2!.id;

      // Create chunks for both scraped contents
      const chunk1 = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
      });
      const chunk2 = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId2,
      });

      await repository.createTextChunk(chunk1);
      await repository.createTextChunk(chunk2);

      // Delete chunks from first scraped content only
      await repository.deleteByScrapedContentId(testScrapedContentId);

      const found1 = await repository.findByScrapedContentId(testScrapedContentId);
      const found2 = await repository.findByScrapedContentId(testScrapedContentId2);

      expect(found1).toHaveLength(0);
      expect(found2).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("should delete a specific chunk by ID", async () => {
      const textChunkData = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
      });
      const created = await repository.createTextChunk(textChunkData);

      await repository.delete(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it("should delete image chunk and its binary data", async () => {
      const imageChunkData = TestDataFactory.createImageChunk({
        scrapedContentId: testScrapedContentId,
      });
      const created = await repository.createImageChunk(imageChunkData);

      await repository.delete(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it("should not affect other chunks when deleting one", async () => {
      const textChunk1 = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
        index: 0,
      });
      const textChunk2 = TestDataFactory.createTextChunk({
        scrapedContentId: testScrapedContentId,
        index: 1,
      });

      const created1 = await repository.createTextChunk(textChunk1);
      const created2 = await repository.createTextChunk(textChunk2);

      await repository.delete(created1.id);

      const found1 = await repository.findById(created1.id);
      const found2 = await repository.findById(created2.id);

      expect(found1).toBeNull();
      expect(found2).toBeDefined();
      expect(found2!.id).toBe(created2.id);
    });
  });

  describe("transaction handling", () => {
    it("should rollback text chunk creation on transaction failure", async () => {
      const db = getTestDatabase();
      const invalidRepository = new ContentChunkRepositoryImpl(db);

      // Create text chunk with invalid scraped content ID (should fail foreign key constraint)
      const invalidTextChunk = TestDataFactory.createTextChunk({
        scrapedContentId: "00000000-0000-0000-0000-000000000000",
      });

      await expect(invalidRepository.createTextChunk(invalidTextChunk)).rejects.toThrow();

      // Verify no orphaned data exists
      const allChunks = await repository.findByScrapedContentId(testScrapedContentId);
      expect(allChunks).toHaveLength(0);
    });

    it("should rollback image chunk creation on transaction failure", async () => {
      const db = getTestDatabase();
      const invalidRepository = new ContentChunkRepositoryImpl(db);

      // Create image chunk with invalid scraped content ID
      const invalidImageChunk = TestDataFactory.createImageChunk({
        scrapedContentId: "00000000-0000-0000-0000-000000000000",
      });

      await expect(invalidRepository.createImageChunk(invalidImageChunk)).rejects.toThrow();

      // Verify no orphaned data exists
      const allChunks = await repository.findByScrapedContentId(testScrapedContentId);
      expect(allChunks).toHaveLength(0);
    });
  });

  describe("complex scenarios", () => {
    it("should handle mixed content chunks in proper order", async () => {
      const mixedChunks = TestDataFactory.createMixedContentChunks(
        3, // 3 text chunks
        2, // 2 image chunks
        testScrapedContentId
      );

      // Create chunks in random order
      const shuffled = [...mixedChunks].sort(() => Math.random() - 0.5);

      for (const chunk of shuffled) {
        if ("content" in chunk) {
          await repository.createTextChunk(chunk);
        } else {
          await repository.createImageChunk(chunk);
        }
      }

      const found = await repository.findByScrapedContentId(testScrapedContentId);

      expect(found).toHaveLength(5);

      // Should be sorted by index regardless of creation order
      for (let i = 0; i < found.length - 1; i++) {
        expect(found[i].index).toBeLessThan(found[i + 1].index);
      }

      // Verify content integrity
      const textChunks = found.filter((chunk): chunk is TextChunk => chunk.chunkType === "text");
      const imageChunks = found.filter((chunk): chunk is ImageChunk => chunk.chunkType === "image");

      expect(textChunks).toHaveLength(3);
      expect(imageChunks).toHaveLength(2);

      expect(textChunks.every((chunk) => typeof chunk.content === "string")).toBe(true);
      expect(imageChunks.every((chunk) => Buffer.isBuffer(chunk.imageData))).toBe(true);
    });

    it("should handle large amounts of chunks efficiently", async () => {
      const textChunks = TestDataFactory.createMultipleTextChunks(50, testScrapedContentId);
      const imageChunks = TestDataFactory.createMultipleImageChunks(50, testScrapedContentId);

      // Adjust indexes to prevent conflicts
      imageChunks.forEach((chunk, i) => {
        chunk.index = i + 50;
      });

      const startTime = Date.now();

      // Create all chunks
      const promises = [];
      for (const chunk of textChunks) {
        promises.push(repository.createTextChunk(chunk));
      }
      for (const chunk of imageChunks) {
        promises.push(repository.createImageChunk(chunk));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const found = await repository.findByScrapedContentId(testScrapedContentId);

      expect(found).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify proper ordering
      for (let i = 0; i < found.length - 1; i++) {
        expect(found[i].index).toBeLessThan(found[i + 1].index);
      }
    });
  });

  describe("error handling", () => {
    it("should handle invalid foreign key constraints", async () => {
      // Try to create a chunk with non-existent scraped content ID
      const invalidChunk = TestDataFactory.createTextChunk({
        scrapedContentId: "00000000-0000-0000-0000-000000000000",
      });

      await expect(repository.createTextChunk(invalidChunk)).rejects.toThrow();
    });

    it("should handle invalid chunk deletion gracefully", async () => {
      // Delete should complete without throwing, even if chunk doesn't exist
      await expect(
        repository.delete("00000000-0000-0000-0000-000000000000")
      ).resolves.toBeUndefined();
    });

    it("should handle invalid scraped content deletion gracefully", async () => {
      // Delete should complete without throwing, even if scraped content doesn't exist
      await expect(
        repository.deleteByScrapedContentId("00000000-0000-0000-0000-000000000000")
      ).resolves.toBeUndefined();
    });
  });
});