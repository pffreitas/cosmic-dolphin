import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { CollectionServiceImpl } from "../../services/collection.service";
import { MIN_SUGGESTION_SUPPORT } from "../../services/bookmark.filing.service";
import { CollectionRepository } from "../../repositories/collection.repository";
import { BookmarkService } from "../../services/bookmark.service";

/**
 * Accepting a suggestion is the only path from a proposal to a collection, and
 * it starts with a person pressing Create. These tests are the other half of
 * "no collection is created by the pipeline": the creation that does exist is
 * reachable only from here.
 */
describe("CollectionService — suggestions", () => {
  let collectionRepository: jest.Mocked<CollectionRepository>;
  let bookmarkService: jest.Mocked<BookmarkService>;
  let service: CollectionServiceImpl;

  const pendingRow = {
    id: "suggestion-1",
    user_id: "user-1",
    name: "Machine learning",
    parent_id: null as string | null,
    bookmark_ids: ["b1", "b2", "b3", "b4", "b5"],
    status: "pending" as const,
    dismissed_until: null as Date | null,
    created_at: new Date(),
  };

  const createdCollection = {
    id: "ml-id",
    name: "Machine learning",
    parent_id: null,
    user_id: "user-1",
    description: null,
    color: null,
    icon: null,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    collectionRepository = {
      findByIdAndUser: jest.fn<any>(),
      findByUser: jest.fn<any>(),
      findByNameAndParent: jest.fn<any>().mockResolvedValue(null),
      findTreeByUser: jest.fn<any>(),
      create: jest.fn<any>().mockResolvedValue(createdCollection),
      update: jest.fn<any>(),
      delete: jest.fn<any>(),
      getCollectionPath: jest.fn<any>(),
      getCollectionsByIds: jest.fn<any>(),
      recordSuggestionSupport: jest.fn<any>(),
      findSuggestionsByUser: jest.fn<any>().mockResolvedValue([]),
      findSuggestionByIdAndUser: jest.fn<any>().mockResolvedValue(pendingRow),
      updateSuggestionStatus: jest.fn<any>().mockImplementation(
        async (_id: string, _userId: string, status: string, dismissedUntil: Date | null) => ({
          ...pendingRow,
          status,
          dismissed_until: dismissedUntil ?? null,
        })
      ),
    } as unknown as jest.Mocked<CollectionRepository>;

    bookmarkService = {
      fileByPipeline: jest.fn<any>().mockResolvedValue({ id: "b1" }),
    } as unknown as jest.Mocked<BookmarkService>;

    service = new CollectionServiceImpl(collectionRepository, bookmarkService);
  });

  it("only offers proposals with enough support behind them", async () => {
    await service.findOfferableSuggestions("user-1");

    expect(collectionRepository.findSuggestionsByUser).toHaveBeenCalledWith(
      "user-1",
      { status: "pending", minSupport: MIN_SUGGESTION_SUPPORT }
    );
  });

  it("creates the collection and files its supporters when the user accepts", async () => {
    const result = await service.acceptSuggestion("suggestion-1", "user-1");

    expect(collectionRepository.create).toHaveBeenCalledWith({
      name: "Machine learning",
      user_id: "user-1",
      parent_id: null,
    });
    expect(bookmarkService.fileByPipeline).toHaveBeenCalledTimes(5);
    expect(result.filedCount).toBe(5);
    expect(collectionRepository.updateSuggestionStatus).toHaveBeenCalledWith(
      "suggestion-1",
      "user-1",
      "accepted"
    );
  });

  it("does not move a supporter the user has since filed by hand", async () => {
    // `fileByPipeline` refuses an overridden bookmark, and accepting the
    // grouping is not a licence to undo that decision.
    (bookmarkService.fileByPipeline as jest.Mock).mockImplementation(
      async (id: unknown) => (id === "b3" ? null : { id })
    );

    const result = await service.acceptSuggestion("suggestion-1", "user-1");

    expect(result.filedCount).toBe(4);
  });

  it("reuses a collection the user created by hand in the meantime", async () => {
    (collectionRepository.findByNameAndParent as jest.Mock).mockImplementation(
      async () => createdCollection
    );

    await service.acceptSuggestion("suggestion-1", "user-1");

    expect(collectionRepository.create).not.toHaveBeenCalled();
  });

  it("refuses a third level", async () => {
    (collectionRepository.findSuggestionByIdAndUser as jest.Mock).mockImplementation(
      async () => ({ ...pendingRow, parent_id: "child-id" })
    );
    (collectionRepository.findByIdAndUser as jest.Mock).mockImplementation(
      async () => ({ ...createdCollection, id: "child-id", parent_id: "root-id" })
    );

    await expect(
      service.acceptSuggestion("suggestion-1", "user-1")
    ).rejects.toThrow("two levels");
    expect(collectionRepository.create).not.toHaveBeenCalled();
  });

  it("refuses to accept a proposal twice", async () => {
    (collectionRepository.findSuggestionByIdAndUser as jest.Mock).mockImplementation(
      async () => ({ ...pendingRow, status: "accepted" })
    );

    await expect(
      service.acceptSuggestion("suggestion-1", "user-1")
    ).rejects.toThrow("already accepted");
    expect(collectionRepository.create).not.toHaveBeenCalled();
  });

  it("remembers a dismissal for 30 days rather than for ever", async () => {
    const before = Date.now();

    const dismissed = await service.dismissSuggestion("suggestion-1", "user-1");

    expect(dismissed.status).toBe("dismissed");
    const until = dismissed.dismissedUntil!.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(until).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
    expect(until).toBeLessThanOrEqual(Date.now() + thirtyDays + 1000);
    expect(collectionRepository.create).not.toHaveBeenCalled();
  });
});
