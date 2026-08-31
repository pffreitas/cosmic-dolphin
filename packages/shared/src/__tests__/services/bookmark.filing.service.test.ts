import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  BookmarkFilingServiceImpl,
  MIN_SUGGESTION_SUPPORT,
} from "../../services/bookmark.filing.service";
import { CollectionRepository } from "../../repositories/collection.repository";
import { BookmarkService } from "../../services/bookmark.service";
import { AI } from "../../ai";
import { Session } from "../../ai/types";
import { Bookmark } from "../../types";

/**
 * The `file` phase.
 *
 * Two things are being proved here, and they are the two the deliverable is
 * judged on: the pipeline never moves a bookmark a person filed, and the model
 * has exactly three ways to answer — an existing collection, a proposal, or
 * nothing — none of which creates a collection.
 */
describe("BookmarkFilingService", () => {
  const session: Session = {
    sessionID: "session-1",
    refID: "bookmark-1",
  } as Session;

  const tree = [
    {
      id: "reading-id",
      name: "Reading",
      parent_id: null,
      user_id: "user-1",
      description: null,
      color: null,
      icon: null,
      is_public: false,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: "papers-id",
      name: "Papers",
      parent_id: "reading-id",
      user_id: "user-1",
      description: null,
      color: null,
      icon: null,
      is_public: false,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  let collectionRepository: jest.Mocked<CollectionRepository>;
  let bookmarkService: jest.Mocked<BookmarkService>;
  let ai: jest.Mocked<AI>;
  let service: BookmarkFilingServiceImpl;
  let bookmark: Bookmark;

  const answer = (value: any) => {
    (ai.generateObjectWithUsage as jest.Mock).mockImplementation(
      async () => value
    );
    (ai.generateObject as jest.Mock).mockImplementation(async () => value);
  };

  beforeEach(() => {
    collectionRepository = {
      findByIdAndUser: jest.fn<any>(),
      findByUser: jest.fn<any>(),
      findByNameAndParent: jest.fn<any>(),
      findTreeByUser: jest.fn<any>().mockResolvedValue(tree),
      create: jest.fn<any>(),
      update: jest.fn<any>(),
      delete: jest.fn<any>(),
      getCollectionPath: jest.fn<any>(),
      getCollectionsByIds: jest.fn<any>(),
      recordSuggestionSupport: jest.fn<any>(),
      findSuggestionsByUser: jest.fn<any>(),
      findSuggestionByIdAndUser: jest.fn<any>(),
      updateSuggestionStatus: jest.fn<any>(),
    } as unknown as jest.Mocked<CollectionRepository>;

    bookmarkService = {
      fileByPipeline: jest
        .fn<any>()
        .mockImplementation(async (id: string, collectionId: string | null) => ({
          ...bookmark,
          id,
          collectionId: collectionId ?? undefined,
        })),
      refileByUser: jest.fn<any>(),
      getTopTags: jest.fn<any>().mockResolvedValue([]),
    } as unknown as jest.Mocked<BookmarkService>;

    ai = {
      generateObject: jest.fn<any>(),
      generateObjectWithUsage: jest.fn<any>(),
    } as unknown as jest.Mocked<AI>;

    service = new BookmarkFilingServiceImpl(
      collectionRepository,
      bookmarkService,
      ai
    );

    bookmark = {
      id: "bookmark-1",
      sourceUrl: "https://example.com/a",
      title: "An article",
      userId: "user-1",
      filingSource: "ai",
      cosmicTags: ["testing"],
      cosmicBriefSummary: "A short brief.",
      isPrivateLink: false,
      isPublic: false,
      processingStatus: "processing",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("the override rule", () => {
    it("refuses to touch a bookmark a person filed, without even asking the model", async () => {
      bookmark.filingSource = "user";

      const result = await service.file(session, bookmark);

      expect(result).toEqual({ outcome: "override" });
      expect(ai.generateObject).not.toHaveBeenCalled();
      expect(ai.generateObjectWithUsage).not.toHaveBeenCalled();
      expect(bookmarkService.fileByPipeline).not.toHaveBeenCalled();
      expect(collectionRepository.findTreeByUser).not.toHaveBeenCalled();
    });

    it("reports an override when the user refiles between the decision and the write", async () => {
      // The guard that matters is in SQL: `fileByPipeline` returns null when
      // `filing_source` has become 'user' since the run read the bookmark.
      answer({
        existingCollectionId: "reading-id",
        newCollection: null,
        confidence: 0.95,
        reasoning: "Plainly reading.",
      });
      (bookmarkService.fileByPipeline as jest.Mock).mockImplementation(
        async () => null
      );

      const result = await service.file(session, bookmark);

      expect(result).toEqual({ outcome: "override" });
      expect(collectionRepository.create).not.toHaveBeenCalled();
    });

    it("does not move a bookmark when the proposal resolves to an existing collection either", async () => {
      answer({
        existingCollectionId: null,
        newCollection: { name: "reading", parentId: null },
        confidence: 0.9,
        reasoning: "Proposing something they already have.",
      });
      (bookmarkService.fileByPipeline as jest.Mock).mockImplementation(
        async () => null
      );

      const result = await service.file(session, bookmark);

      expect(result).toEqual({ outcome: "override" });
      expect(collectionRepository.recordSuggestionSupport).not.toHaveBeenCalled();
    });
  });

  describe("outcome 1 — an existing collection", () => {
    it("files into it, through the guarded write, and creates nothing", async () => {
      answer({
        existingCollectionId: "papers-id",
        newCollection: null,
        confidence: 0.88,
        reasoning: "It is a paper.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "filed",
        collectionId: "papers-id",
        collectionPath: ["Reading", "Papers"],
      });
      expect(bookmarkService.fileByPipeline).toHaveBeenCalledWith(
        "bookmark-1",
        "papers-id"
      );
      expect(collectionRepository.create).not.toHaveBeenCalled();
    });

    it("falls back to the Inbox when the model names a collection that does not exist", async () => {
      answer({
        existingCollectionId: "a-collection-the-user-does-not-have",
        newCollection: null,
        confidence: 0.99,
        reasoning: "Confidently wrong.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "inbox",
        reason: "unknown_collection",
      });
      // The old categoriser would have created it to make the answer true.
      expect(collectionRepository.create).not.toHaveBeenCalled();
      expect(bookmarkService.fileByPipeline).not.toHaveBeenCalled();
    });

    it("leaves a low-confidence match in the Inbox", async () => {
      answer({
        existingCollectionId: "reading-id",
        newCollection: null,
        confidence: 0.3,
        reasoning: "Not sure.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({ outcome: "inbox", reason: "low_confidence" });
      expect(bookmarkService.fileByPipeline).not.toHaveBeenCalled();
    });
  });

  describe("outcome 2 — a proposal", () => {
    const suggestionRow = (bookmarkIds: string[]) => ({
      id: "suggestion-1",
      user_id: "user-1",
      name: "Machine learning",
      parent_id: null,
      bookmark_ids: bookmarkIds,
      status: "pending" as const,
      dismissed_until: null,
      created_at: new Date(),
    });

    beforeEach(() => {
      answer({
        existingCollectionId: null,
        newCollection: { name: "Machine learning", parentId: null },
        confidence: 0.85,
        reasoning: "Recurring subject with no home.",
      });
    });

    it("records support and creates nothing", async () => {
      (collectionRepository.recordSuggestionSupport as jest.Mock).mockImplementation(
        async () => suggestionRow(["bookmark-1"])
      );

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "proposed",
        supportCount: 1,
        readyToOffer: false,
      });
      expect(collectionRepository.recordSuggestionSupport).toHaveBeenCalledWith(
        "user-1",
        "Machine learning",
        null,
        "bookmark-1"
      );
      expect(collectionRepository.create).not.toHaveBeenCalled();
      // The bookmark is not filed anywhere: the collection does not exist.
      expect(bookmarkService.fileByPipeline).not.toHaveBeenCalled();
    });

    it("is offerable only once five bookmarks support it", async () => {
      const supporters = Array.from(
        { length: MIN_SUGGESTION_SUPPORT },
        (_, index) => `bookmark-${index + 1}`
      );
      (collectionRepository.recordSuggestionSupport as jest.Mock).mockImplementation(
        async () => suggestionRow(supporters)
      );

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "proposed",
        supportCount: MIN_SUGGESTION_SUPPORT,
        readyToOffer: true,
      });
      expect(collectionRepository.create).not.toHaveBeenCalled();
    });

    it("files into the existing collection when the proposal names one the user already has", async () => {
      answer({
        existingCollectionId: null,
        newCollection: { name: "reading", parentId: null },
        confidence: 0.9,
        reasoning: "Arrived at the right shelf the long way round.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "filed",
        collectionId: "reading-id",
      });
      expect(collectionRepository.recordSuggestionSupport).not.toHaveBeenCalled();
      expect(collectionRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a proposal that would make the tree three levels deep", async () => {
      answer({
        existingCollectionId: null,
        newCollection: { name: "Transformers", parentId: "papers-id" },
        confidence: 0.9,
        reasoning: "Papers > Transformers.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "inbox",
        reason: "proposal_rejected",
      });
      expect(collectionRepository.recordSuggestionSupport).not.toHaveBeenCalled();
    });

    it("rejects a proposal whose parent is not in the user's tree", async () => {
      answer({
        existingCollectionId: null,
        newCollection: { name: "Transformers", parentId: "someone-elses-id" },
        confidence: 0.9,
        reasoning: "A parent that is not theirs.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "inbox",
        reason: "proposal_rejected",
      });
      expect(collectionRepository.recordSuggestionSupport).not.toHaveBeenCalled();
    });

    it("stays in the Inbox when the user has already dismissed or accepted this name", async () => {
      (collectionRepository.recordSuggestionSupport as jest.Mock).mockImplementation(
        async () => null
      );

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({
        outcome: "inbox",
        reason: "proposal_rejected",
      });
      expect(collectionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("outcome 3 — nothing", () => {
    it("leaves the bookmark in the Inbox, writes nothing, and is not a failure", async () => {
      answer({
        existingCollectionId: null,
        newCollection: null,
        confidence: 0.4,
        reasoning: "A one-off. Nothing in the tree is close.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({ outcome: "inbox", reason: "model_declined" });
      expect(bookmarkService.fileByPipeline).not.toHaveBeenCalled();
      expect(collectionRepository.create).not.toHaveBeenCalled();
      expect(collectionRepository.recordSuggestionSupport).not.toHaveBeenCalled();
    });

    it("is what an empty tree produces, rather than an invented collection", async () => {
      (collectionRepository.findTreeByUser as jest.Mock).mockImplementation(
        async () => []
      );
      answer({
        existingCollectionId: null,
        newCollection: null,
        confidence: 0.2,
        reasoning: "No tree yet.",
      });

      const result = await service.file(session, bookmark);

      expect(result).toMatchObject({ outcome: "inbox" });
      expect(collectionRepository.create).not.toHaveBeenCalled();
    });
  });
});
