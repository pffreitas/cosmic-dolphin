import { describe, it, expect, mock } from "bun:test";
import {
  CollectionError,
  CollectionServiceImpl,
  COLLECTION_MAX_DEPTH_MESSAGE,
  type CollectionRepository,
  type BookmarkService,
} from "@cosmic-dolphin/shared";
import {
  collectionErrorStatus,
  createCollectionSchema,
  refileBookmarkSchema,
  updateCollectionSchema,
} from "../routes/collections";
import { refileBookmarkForUser } from "../routes/bookmarks";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const ROOT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_ROOT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

interface Row {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

function row(overrides: Partial<Row> & Pick<Row, "id" | "name">): Row {
  return {
    parent_id: null,
    user_id: USER,
    description: null,
    color: null,
    icon: null,
    is_public: false,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/**
 * An in-memory stand-in for the collections table.
 *
 * The depth cap is the thing under test and it is a rule about the *shape of
 * the tree*, not about one row — a fake that stores real rows and answers real
 * lookups is what lets the "reparent a collection that has children" case be
 * exercised at all. Mocking each lookup individually would let the test agree
 * with a wrong implementation.
 */
function createRepository(rows: Row[]) {
  const store = new Map(rows.map((r) => [r.id, { ...r }]));

  return {
    store,
    repository: {
      findByIdAndUser: mock(async (id: string, userId: string) => {
        const found = store.get(id);
        return found && found.user_id === userId ? found : null;
      }),
      findByUser: mock(async (userId: string) =>
        [...store.values()].filter((r) => r.user_id === userId)
      ),
      findByNameAndParent: mock(async () => null),
      findTreeByUser: mock(async () => []),
      create: mock(async (data: any) => {
        const created = row({
          id: `created-${store.size}`,
          name: data.name,
          ...data,
          parent_id: data.parent_id ?? null,
        });
        store.set(created.id, created);
        return created;
      }),
      update: mock(async (id: string, data: any) => {
        const existing = store.get(id)!;
        const updated = { ...existing, ...data };
        store.set(id, updated);
        return updated;
      }),
      delete: mock(async (id: string) => {
        store.delete(id);
      }),
      getCollectionPath: mock(async () => []),
      getCollectionsByIds: mock(async () => new Map()),
      recordSuggestionSupport: mock(async () => null),
      findSuggestionsByUser: mock(async () => []),
      findSuggestionByIdAndUser: mock(async () => null),
      updateSuggestionStatus: mock(async () => null),
    } as unknown as CollectionRepository,
  };
}

function createService(rows: Row[]) {
  const { repository, store } = createRepository(rows);
  const bookmarkService = {
    fileByPipeline: mock(async () => null),
  } as unknown as BookmarkService;

  return {
    store,
    repository,
    service: new CollectionServiceImpl(repository, bookmarkService),
  };
}

describe("Collections — the two-level cap", () => {
  it("creates a root collection", async () => {
    const { service } = createService([]);

    const created = await service.createForUser(USER, { name: "  Design  " });

    expect(created.name).toBe("Design");
    expect(created.parentId).toBe(null as unknown as string);
  });

  it("creates a second level under a root", async () => {
    const { service } = createService([row({ id: ROOT, name: "Design" })]);

    const created = await service.createForUser(USER, {
      name: "Typography",
      parentId: ROOT,
    });

    expect(created.parentId).toBe(ROOT);
  });

  it("refuses a third level at creation", async () => {
    const { service } = createService([
      row({ id: ROOT, name: "Design" }),
      row({ id: CHILD, name: "Typography", parent_id: ROOT }),
    ]);

    const error = await service
      .createForUser(USER, { name: "Kerning", parentId: CHILD })
      .catch((e) => e);

    expect(error).toBeInstanceOf(CollectionError);
    expect(error.code).toBe("max_depth");
    expect(collectionErrorStatus(error)).toBe(422);
  });

  it("refuses a parent that belongs to someone else", async () => {
    const { service } = createService([
      row({ id: OTHER_ROOT, name: "Theirs", user_id: OTHER_USER }),
    ]);

    const error = await service
      .createForUser(USER, { name: "Mine", parentId: OTHER_ROOT })
      .catch((e) => e);

    expect(error.code).toBe("parent_not_found");
    expect(collectionErrorStatus(error)).toBe(404);
  });

  it("refuses an empty name", async () => {
    const { service } = createService([]);

    const error = await service
      .createForUser(USER, { name: "   " })
      .catch((e) => e);

    expect(error.code).toBe("invalid");
    expect(collectionErrorStatus(error)).toBe(400);
  });
});

describe("Collections — reparenting cannot smuggle in a third level", () => {
  it("renames and recolours without touching the parent", async () => {
    const { service, store } = createService([
      row({ id: ROOT, name: "Design" }),
      row({ id: CHILD, name: "Typography", parent_id: ROOT }),
    ]);

    const updated = await service.updateForUser(CHILD, USER, {
      name: "Type & reading",
      color: "collection-amber",
    });

    expect(updated.name).toBe("Type & reading");
    expect(updated.color).toBe("collection-amber");
    // Absent means "leave it alone", not "move to root".
    expect(store.get(CHILD)!.parent_id).toBe(ROOT);
  });

  it("moves a leaf under a root", async () => {
    const { service, store } = createService([
      row({ id: ROOT, name: "Design" }),
      row({ id: CHILD, name: "Typography" }),
    ]);

    await service.updateForUser(CHILD, USER, { parentId: ROOT });

    expect(store.get(CHILD)!.parent_id).toBe(ROOT);
  });

  it("moves a nested collection back to the root with parentId: null", async () => {
    const { service, store } = createService([
      row({ id: ROOT, name: "Design" }),
      row({ id: CHILD, name: "Typography", parent_id: ROOT }),
    ]);

    await service.updateForUser(CHILD, USER, { parentId: null });

    expect(store.get(CHILD)!.parent_id).toBe(null);
  });

  // The first of the two ways in: the destination is already a child, so the
  // collection being moved would land at level three.
  it("refuses a move under a collection that is itself nested", async () => {
    const { service, store } = createService([
      row({ id: ROOT, name: "Design" }),
      row({ id: CHILD, name: "Typography", parent_id: ROOT }),
      row({ id: OTHER_ROOT, name: "Reading" }),
    ]);

    const error = await service
      .updateForUser(OTHER_ROOT, USER, { parentId: CHILD })
      .catch((e) => e);

    expect(error).toBeInstanceOf(CollectionError);
    expect(error.message).toContain(COLLECTION_MAX_DEPTH_MESSAGE);
    expect(collectionErrorStatus(error)).toBe(422);
    // And nothing moved.
    expect(store.get(OTHER_ROOT)!.parent_id).toBe(null);
  });

  // The second, and the one that is invisible if you only look at the row being
  // moved: it lands legally at level two, but drags its own children to three.
  it("refuses to move a collection that already has children", async () => {
    const { service, store, repository } = createService([
      row({ id: ROOT, name: "Design" }),
      row({ id: CHILD, name: "Typography", parent_id: ROOT }),
      row({ id: OTHER_ROOT, name: "Reading" }),
    ]);

    const error = await service
      .updateForUser(ROOT, USER, { parentId: OTHER_ROOT })
      .catch((e) => e);

    expect(error).toBeInstanceOf(CollectionError);
    expect(error.code).toBe("max_depth");
    expect(collectionErrorStatus(error)).toBe(422);
    expect(repository.update).not.toHaveBeenCalled();
    expect(store.get(ROOT)!.parent_id).toBe(null);
    expect(store.get(CHILD)!.parent_id).toBe(ROOT);
  });

  it("refuses a collection as its own parent", async () => {
    const { service } = createService([row({ id: ROOT, name: "Design" })]);

    const error = await service
      .updateForUser(ROOT, USER, { parentId: ROOT })
      .catch((e) => e);

    expect(error.code).toBe("invalid");
    expect(collectionErrorStatus(error)).toBe(400);
  });

  it("refuses to update a collection the caller does not own", async () => {
    const { service } = createService([
      row({ id: OTHER_ROOT, name: "Theirs", user_id: OTHER_USER }),
    ]);

    const error = await service
      .updateForUser(OTHER_ROOT, USER, { name: "Mine now" })
      .catch((e) => e);

    expect(error.code).toBe("not_found");
    expect(collectionErrorStatus(error)).toBe(404);
  });
});

describe("Collections — delete", () => {
  it("removes the collection and never a bookmark", async () => {
    const { service, store, repository } = createService([
      row({ id: ROOT, name: "Design" }),
    ]);

    await service.deleteForUser(ROOT, USER);

    expect(repository.delete).toHaveBeenCalledWith(ROOT);
    expect(store.has(ROOT)).toBe(false);
    // The bookmarks are moved by `bookmarks.collection_id ON DELETE SET NULL`,
    // and Inbox *is* `collection_id IS NULL`. Nothing in the service deletes a
    // bookmark, and nothing here is given the chance to.
  });

  it("404s on someone else's collection instead of deleting it", async () => {
    const { service, repository } = createService([
      row({ id: OTHER_ROOT, name: "Theirs", user_id: OTHER_USER }),
    ]);

    const error = await service.deleteForUser(OTHER_ROOT, USER).catch((e) => e);

    expect(error.code).toBe("not_found");
    expect(repository.delete).not.toHaveBeenCalled();
  });
});

describe("PATCH /bookmarks/:id/collection", () => {
  const bookmark = { id: "bookmark-1", sourceUrl: "https://example.com" };

  function createServices(overrides: {
    collection?: unknown;
    refiled?: unknown;
  } = {}) {
    return {
      collection: {
        findByIdAndUser: mock(async () =>
          overrides.collection === undefined
            ? { id: ROOT, name: "Design", userId: USER }
            : overrides.collection
        ),
      },
      bookmark: {
        refileByUser: mock(async () =>
          overrides.refiled === undefined ? bookmark : overrides.refiled
        ),
      },
    } as any;
  }

  it("moves the bookmark through refileByUser, the one write that also sets filing_source", async () => {
    const services = createServices();

    const result = await refileBookmarkForUser(services, "bookmark-1", USER, ROOT);

    expect(result.statusCode).toBeUndefined();
    expect(services.bookmark.refileByUser).toHaveBeenCalledWith(
      "bookmark-1",
      USER,
      ROOT
    );
  });

  it("moves a bookmark to Inbox with a null collection, without looking one up", async () => {
    const services = createServices();

    await refileBookmarkForUser(services, "bookmark-1", USER, null);

    expect(services.collection.findByIdAndUser).not.toHaveBeenCalled();
    expect(services.bookmark.refileByUser).toHaveBeenCalledWith(
      "bookmark-1",
      USER,
      null
    );
  });

  it("404s on a collection the caller does not own, and does not move anything", async () => {
    const services = createServices({ collection: null });

    const result = await refileBookmarkForUser(services, "bookmark-1", USER, ROOT);

    expect(result).toEqual({
      statusCode: 404,
      body: { error: "Collection not found" },
    });
    expect(services.bookmark.refileByUser).not.toHaveBeenCalled();
  });

  it("404s when the bookmark is not the caller's", async () => {
    const services = createServices({ refiled: null });

    const result = await refileBookmarkForUser(services, "bookmark-1", USER, ROOT);

    expect(result).toEqual({
      statusCode: 404,
      body: { error: "Bookmark not found" },
    });
  });
});

describe("Collection request validation", () => {
  it("requires a name to create", () => {
    expect(createCollectionSchema.safeParse({}).success).toBe(false);
    expect(createCollectionSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(createCollectionSchema.safeParse({ name: "Design" }).success).toBe(
      true
    );
  });

  it("caps the name length", () => {
    expect(
      createCollectionSchema.safeParse({ name: "x".repeat(121) }).success
    ).toBe(false);
  });

  it("rejects a parentId that is not an id", () => {
    expect(
      createCollectionSchema.safeParse({ name: "Design", parentId: "nope" })
        .success
    ).toBe(false);
  });

  it("accepts a partial update and rejects an empty one", () => {
    expect(updateCollectionSchema.safeParse({ name: "Renamed" }).success).toBe(
      true
    );
    expect(updateCollectionSchema.safeParse({ parentId: null }).success).toBe(
      true
    );
    expect(updateCollectionSchema.safeParse({}).success).toBe(false);
  });

  it("requires collectionId on a refile, so an empty body cannot unfile a bookmark", () => {
    expect(refileBookmarkSchema.safeParse({}).success).toBe(false);
    expect(refileBookmarkSchema.safeParse({ collectionId: null }).success).toBe(
      true
    );
    expect(
      refileBookmarkSchema.safeParse({ collectionId: ROOT }).success
    ).toBe(true);
  });
});

describe("Collection error status mapping", () => {
  it("gives a broken rule its own status and leaves anything else to the 500", () => {
    expect(collectionErrorStatus(new CollectionError("invalid", "x"))).toBe(400);
    expect(collectionErrorStatus(new CollectionError("not_found", "x"))).toBe(
      404
    );
    expect(
      collectionErrorStatus(new CollectionError("parent_not_found", "x"))
    ).toBe(404);
    expect(collectionErrorStatus(new CollectionError("conflict", "x"))).toBe(
      409
    );
    expect(collectionErrorStatus(new CollectionError("max_depth", "x"))).toBe(
      422
    );
    expect(collectionErrorStatus(new Error("database is on fire"))).toBe(null);
  });
});
