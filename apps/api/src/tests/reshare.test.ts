import { describe, it, expect, mock } from "bun:test";
import path from "node:path";
import {
  BookmarkServiceImpl,
  SocialServiceImpl,
  type Bookmark,
  type SocialRepository,
} from "@cosmic-dolphin/shared";

import { reshareBookmarkForUser } from "../routes/bookmarks";

/**
 * D13, at the two levels its promises actually live at.
 *
 *  - **A reshare is filed into the resharer's own tree.** Nothing about the
 *    original's filing travels: the new row is inserted with
 *    `collection_id: null` — Inbox — and enqueued *for the resharer*, so the
 *    `file` phase runs against their collections and their budget. Asserted on
 *    the insert the service builds, because that is where a copied
 *    `collection_id` would have to appear.
 *
 *  - **Resharing twice is a no-op.** Not a second code path: the reshare
 *    inherits the URL, so it meets the same `(user_id, source_url)` uniqueness
 *    constraint a duplicate paste does, and comes back through D4's
 *    already-saved answer. The fake library below enforces that constraint the
 *    way the index does, so the second call is refused by the data and not by
 *    an `if` in the test.
 *
 *  - **Deleting the original does not affect the reshare.** The column is
 *    `ON DELETE SET NULL`, so the save survives with no provenance rather than
 *    being cascaded away or left pointing at a row that is gone. The fake
 *    reproduces that rule; the migration is asserted separately, because the
 *    fake is only as true as the schema it imitates.
 */

// ---------------------------------------------------------------------------
// A library that enforces the constraints this deliverable leans on
// ---------------------------------------------------------------------------

class FakeLibrary {
  rows: Bookmark[] = [];
  queued: { bookmarkId: string; userId: string }[] = [];
  withinBudget = true;

  private nextId = 1;

  add(bookmark: Partial<Bookmark> & { userId: string; sourceUrl: string }) {
    const row: Bookmark = {
      id: `bookmark-${this.nextId++}`,
      isPrivateLink: false,
      isPublic: false,
      processingStatus: "completed",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      ...bookmark,
    } as Bookmark;
    this.rows.push(row);
    return row;
  }

  /** `ON DELETE SET NULL`, as the FK D6 added does it. */
  delete(id: string) {
    this.rows = this.rows.filter((row) => row.id !== id);
    for (const row of this.rows) {
      if (row.savedFromBookmarkId === id) row.savedFromBookmarkId = undefined;
    }
  }

  services(social: { canInteract: (a: string, b: string) => Promise<boolean> }) {
    return {
      bookmark: {
        findVisibleById: mock(async (id: string, viewerId: string) => {
          const row = this.rows.find((candidate) => candidate.id === id);
          if (!row) return null;
          if (!row.isPublic && row.userId !== viewerId) return null;
          return row;
        }),
        findByUserAndUrl: mock(async (userId: string, sourceUrl: string) => {
          return (
            this.rows.find(
              (row) => row.userId === userId && row.sourceUrl === sourceUrl
            ) ?? null
          );
        }),
        create: mock(async (url: string, userId: string, options: any = {}) => {
          // The unique index, not politeness. A second insert of the same
          // (user, url) is what the constraint exists to stop.
          if (
            this.rows.some(
              (row) => row.userId === userId && row.sourceUrl === url
            )
          ) {
            throw new Error(
              "duplicate key value violates unique constraint bookmarks_user_id_source_url_key"
            );
          }
          return this.add({
            sourceUrl: url,
            userId,
            title: options.title,
            collectionId: options.collectionId ?? undefined,
            savedFromBookmarkId: options.savedFromBookmarkId ?? undefined,
            processingStatus: "idle",
          });
        }),
        updateProcessingStatus: mock(
          async (id: string, status: Bookmark["processingStatus"]) => {
            const row = this.rows.find((candidate) => candidate.id === id)!;
            row.processingStatus = status;
            return row;
          }
        ),
      },
      queue: {
        sendBookmarkProcessingMessage: mock(
          async (bookmarkId: string, userId: string) => {
            this.queued.push({ bookmarkId, userId });
            return 1;
          }
        ),
      },
      processingBudget: {
        check: mock(async () => ({
          withinBudget: this.withinBudget,
          used: this.withinBudget ? 1 : 200,
          limit: 200,
          resetsAt: new Date("2026-01-02T00:00:00Z"),
        })),
      },
      social,
    } as any;
  }
}

const alwaysReachable = {
  canInteract: mock(async () => true),
};

function anOriginal(library: FakeLibrary) {
  return library.add({
    userId: "author",
    sourceUrl: "https://example.com/bottleneck",
    title: "The Bottleneck Was Never Retrieval",
    isPublic: true,
    collectionId: "authors-collection",
    cosmicSummary: "The author's brief, on the author's terms.",
    cosmicTags: ["retrieval", "agents"],
    commentCount: 14,
  });
}

// ---------------------------------------------------------------------------
// A reshare is filed into the resharer's own tree
// ---------------------------------------------------------------------------

describe("POST /bookmarks/:id/reshare", () => {
  it("creates the caller's own bookmark, in their Inbox, with provenance", async () => {
    const library = new FakeLibrary();
    const original = anOriginal(library);
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );

    expect(result.statusCode).toBe(201);
    const saved = (result.body as any).bookmark as Bookmark;

    expect(saved.id).not.toBe(original.id);
    expect(saved.userId).toBe("resharer");
    expect(saved.sourceUrl).toBe(original.sourceUrl);
    expect(saved.savedFromBookmarkId).toBe(original.id);

    // Inbox. The author's collection is the author's tree, and copying it
    // would file a stranger's judgement into this user's library.
    expect(saved.collectionId).toBeUndefined();
    expect(services.bookmark.create).toHaveBeenCalledWith(
      original.sourceUrl,
      "resharer",
      expect.objectContaining({ savedFromBookmarkId: original.id })
    );
    expect(services.bookmark.create.mock.calls[0][2].collectionId).toBeUndefined();
  });

  it("runs the pipeline for the new owner, so the summary is theirs", async () => {
    const library = new FakeLibrary();
    const original = anOriginal(library);
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );
    const saved = (result.body as any).bookmark as Bookmark;

    // Enqueued under the resharer's id: the run reads their tree and their
    // tags, and spends their daily budget.
    expect(library.queued).toEqual([
      { bookmarkId: saved.id, userId: "resharer" },
    ]);
    expect(services.processingBudget.check).toHaveBeenCalledWith("resharer");
    expect(saved.processingStatus).toBe("processing");

    // Nothing of the original's own output was copied forward — it is the
    // pipeline's job to produce this user's version.
    expect(saved.cosmicSummary).toBeUndefined();
    expect(saved.cosmicTags).toBeUndefined();

    // A reshare is a new bookmark and starts at zero comments; the original's
    // thread stays where it was written.
    expect(saved.commentCount).toBeUndefined();
  });

  it("saves idle rather than refusing when the resharer's budget is spent", async () => {
    const library = new FakeLibrary();
    library.withinBudget = false;
    const original = anOriginal(library);
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );

    expect(result.statusCode).toBe(201);
    expect((result.body as any).bookmark.processingStatus).toBe("idle");
    expect((result.body as any).message).toContain("Summarise now");
    expect(library.queued).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Resharing twice is a no-op
  // -------------------------------------------------------------------------

  it("is a no-op the second time, through D4's already-saved answer", async () => {
    const library = new FakeLibrary();
    const original = anOriginal(library);
    const services = library.services(alwaysReachable);

    const first = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );
    const saved = (first.body as any).bookmark as Bookmark;

    const second = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );

    expect(second.statusCode).toBe(200);
    expect((second.body as any).alreadySaved).toBe(true);
    expect((second.body as any).message).toBe("Already in your library");
    // The row the user already has, not a new one.
    expect((second.body as any).bookmark.id).toBe(saved.id);
    expect(library.rows.filter((row) => row.userId === "resharer")).toHaveLength(
      1
    );
    // Nothing re-queued: a second press must not spend the budget again.
    expect(library.queued).toHaveLength(1);
    expect(services.bookmark.create).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the URL is already in the library from a plain save", async () => {
    // Same constraint, reached from the other direction: the user saved the
    // link themselves last week and now meets it in the feed.
    const library = new FakeLibrary();
    const original = anOriginal(library);
    const own = library.add({
      userId: "resharer",
      sourceUrl: original.sourceUrl,
      title: "Saved by hand, weeks ago",
    });
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );

    expect(result.statusCode).toBe(200);
    expect((result.body as any).bookmark.id).toBe(own.id);
    expect((result.body as any).alreadySaved).toBe(true);
    expect(services.bookmark.create).not.toHaveBeenCalled();
  });

  it("answers already-saved rather than duplicating when the caller reshares their own bookmark", async () => {
    const library = new FakeLibrary();
    const own = library.add({
      userId: "resharer",
      sourceUrl: "https://example.com/mine",
      isPublic: true,
    });
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(services, own.id, "resharer");

    expect(result.statusCode).toBe(200);
    expect((result.body as any).alreadySaved).toBe(true);
    expect(library.rows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // What cannot be reshared
  // -------------------------------------------------------------------------

  it("404s on a bookmark that is not public", async () => {
    const library = new FakeLibrary();
    const private_ = library.add({
      userId: "author",
      sourceUrl: "https://example.com/private",
      isPublic: false,
    });
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(
      services,
      private_.id,
      "resharer"
    );

    expect(result).toEqual({
      statusCode: 404,
      body: { error: "Bookmark not found" },
    });
    expect(services.bookmark.create).not.toHaveBeenCalled();
  });

  it("404s when either party has blocked the other", async () => {
    const library = new FakeLibrary();
    const original = anOriginal(library);
    const blocked = { canInteract: mock(async () => false) };
    const services = library.services(blocked);

    const result = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );

    // 404, not 403 — the same refusal the social routes make, and for the same
    // reason: a 403 would confirm both the bookmark and the block.
    expect(result).toEqual({
      statusCode: 404,
      body: { error: "Bookmark not found" },
    });
    expect(blocked.canInteract).toHaveBeenCalledWith("resharer", "author");
    expect(services.bookmark.create).not.toHaveBeenCalled();
  });

  it("404s on a bookmark that no longer exists", async () => {
    const library = new FakeLibrary();
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(services, "gone", "resharer");

    expect(result.statusCode).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Deleting the original
  // -------------------------------------------------------------------------

  it("leaves the reshare intact when the original is deleted, with provenance gone", async () => {
    const library = new FakeLibrary();
    const original = anOriginal(library);
    const services = library.services(alwaysReachable);

    const result = await reshareBookmarkForUser(
      services,
      original.id,
      "resharer"
    );
    const saved = (result.body as any).bookmark as Bookmark;

    library.delete(original.id);

    const survivor = library.rows.find((row) => row.id === saved.id);
    expect(survivor).toBeDefined();
    expect(survivor!.userId).toBe("resharer");
    expect(survivor!.sourceUrl).toBe(original.sourceUrl);
    // Nothing to credit any more. The provenance row has only the domain left,
    // which is why it must never assume the original is still there.
    expect(survivor!.savedFromBookmarkId).toBeUndefined();
  });

  it("declares the provenance column ON DELETE SET NULL in the migration", async () => {
    // The fake above is only as true as the schema it imitates. CASCADE here
    // would delete other people's saves when an author tidies their library;
    // RESTRICT would make the author's own delete fail. Neither is acceptable,
    // and both would be invisible to every other test in this file.
    const cwd = process.cwd();
    const root = cwd.endsWith(path.join("apps", "api"))
      ? path.resolve(cwd, "../..")
      : cwd;
    const migration = await Bun.file(
      path.join(
        root,
        "supabase/migrations/20260827000003_add_filing_source_and_collection_suggestions.sql"
      )
    ).text();

    expect(migration).toMatch(
      /saved_from_bookmark_id uuid\s+REFERENCES bookmarks\(id\) ON DELETE SET NULL/
    );
  });
});

// ---------------------------------------------------------------------------
// The insert itself
// ---------------------------------------------------------------------------

describe("BookmarkService.create — reshare provenance", () => {
  function serviceWithSpy() {
    const created: any[] = [];
    const repository = {
      create: mock(async (row: any) => {
        created.push(row);
        return {
          ...row,
          id: "new-bookmark",
          created_at: new Date("2026-01-01T00:00:00Z"),
          updated_at: new Date("2026-01-01T00:00:00Z"),
        };
      }),
    } as any;
    const webScraping = {
      extractMetadataFromUrl: () => ({
        title: "example.com",
        favicon: undefined,
        siteName: "example.com",
      }),
    } as any;

    return {
      service: new BookmarkServiceImpl(repository, webScraping),
      created,
    };
  }

  it("writes saved_from_bookmark_id and leaves the row in Inbox", async () => {
    const { service, created } = serviceWithSpy();

    await service.create("https://example.com/bottleneck", "resharer", {
      savedFromBookmarkId: "original-1",
      title: "The Bottleneck Was Never Retrieval",
    });

    expect(created[0].saved_from_bookmark_id).toBe("original-1");
    expect(created[0].user_id).toBe("resharer");
    expect(created[0].collection_id).toBeNull();
    // Filing is still the pipeline's to propose — a reshare is not a user
    // decision about where this belongs.
    expect(created[0].filing_source).toBe("ai");
    // The original's title, so the row is legible before `fetch` lands.
    expect(created[0].title).toBe("The Bottleneck Was Never Retrieval");
  });

  it("leaves provenance null on an ordinary save", async () => {
    const { service, created } = serviceWithSpy();

    await service.create("https://example.com/typed-by-hand", "user-1");

    expect(created[0].saved_from_bookmark_id).toBeNull();
    expect(created[0].title).toBe("example.com");
  });
});

// ---------------------------------------------------------------------------
// The block rule the reshare defers to
// ---------------------------------------------------------------------------

describe("SocialService.canInteract", () => {
  function socialWith(relationship: {
    viewerBlocked?: boolean;
    blockedViewer?: boolean;
  }) {
    const repository = {
      relationship: mock(async () => ({
        viewerFollows: false,
        followsViewer: false,
        viewerBlocked: relationship.viewerBlocked === true,
        blockedViewer: relationship.blockedViewer === true,
      })),
    } as unknown as SocialRepository;

    return { service: new SocialServiceImpl(repository), repository };
  }

  it("is true when neither has blocked the other", async () => {
    const { service } = socialWith({});
    expect(await service.canInteract("viewer", "other")).toBe(true);
  });

  it("is false when they blocked the caller", async () => {
    const { service } = socialWith({ blockedViewer: true });
    expect(await service.canInteract("viewer", "other")).toBe(false);
  });

  it("is false when the caller blocked them", async () => {
    // Symmetric in effect. Resharing someone you have blocked would put their
    // save in your library and in your followers' feeds under your name.
    const { service } = socialWith({ viewerBlocked: true });
    expect(await service.canInteract("viewer", "other")).toBe(false);
  });

  it("does not query a relationship with yourself", async () => {
    const { service, repository } = socialWith({});
    expect(await service.canInteract("viewer", "viewer")).toBe(true);
    expect((repository as any).relationship).not.toHaveBeenCalled();
  });
});
