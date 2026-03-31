import { describe, it, expect, beforeEach } from "@jest/globals";
import { BookmarkLikeRepositoryImpl } from "../../repositories/bookmark-like.repository";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";

describe("BookmarkLikeRepository", () => {
  let likeRepository: BookmarkLikeRepositoryImpl;
  let bookmarkRepository: BookmarkRepositoryImpl;
  let testUserId: string;

  beforeEach(() => {
    const db = getTestDatabase();
    likeRepository = new BookmarkLikeRepositoryImpl(db);
    bookmarkRepository = new BookmarkRepositoryImpl(db);
    testUserId = TestDataFactory.generateUserId();
  });

  describe("like", () => {
    it("should return updated like_count without a separate SELECT", async () => {
      const bookmark = await bookmarkRepository.create(
        TestDataFactory.createBookmark({ user_id: testUserId })
      );

      const likeCount = await likeRepository.like(testUserId, bookmark.id);

      expect(likeCount).toBe(1);
    });

    it("should increment like_count on each distinct user like", async () => {
      const bookmark = await bookmarkRepository.create(
        TestDataFactory.createBookmark({ user_id: testUserId })
      );
      const otherUserId = TestDataFactory.generateUserId();

      await likeRepository.like(testUserId, bookmark.id);
      const likeCount = await likeRepository.like(otherUserId, bookmark.id);

      expect(likeCount).toBe(2);
    });

    it("should not increment like_count when user already liked (conflict)", async () => {
      const bookmark = await bookmarkRepository.create(
        TestDataFactory.createBookmark({ user_id: testUserId })
      );

      await likeRepository.like(testUserId, bookmark.id);
      const likeCount = await likeRepository.like(testUserId, bookmark.id);

      expect(likeCount).toBe(1);
    });
  });

  describe("unlike", () => {
    it("should return updated like_count without a separate SELECT", async () => {
      const bookmark = await bookmarkRepository.create(
        TestDataFactory.createBookmark({ user_id: testUserId })
      );
      const otherUserId = TestDataFactory.generateUserId();

      await likeRepository.like(testUserId, bookmark.id);
      await likeRepository.like(otherUserId, bookmark.id);

      const likeCount = await likeRepository.unlike(testUserId, bookmark.id);

      expect(likeCount).toBe(1);
    });

    it("should not decrement below zero when user had not liked", async () => {
      const bookmark = await bookmarkRepository.create(
        TestDataFactory.createBookmark({ user_id: testUserId })
      );

      const likeCount = await likeRepository.unlike(testUserId, bookmark.id);

      expect(likeCount).toBe(0);
    });
  });
});
