import { describe, it, expect } from "bun:test";

import {
  BOOKMARK_SORTS,
  decodeBookmarkCursor,
  encodeBookmarkCursor,
  isBookmarkSort,
  updateBookmarkSchema,
} from "../routes/bookmarks";

describe("GET /bookmarks — sort", () => {
  it("names exactly the four orderings the Library offers", () => {
    expect(BOOKMARK_SORTS).toEqual([
      "newest",
      "oldest",
      "recently_read",
      "longest_unread",
    ]);
  });

  it("rejects anything that is not one of them", () => {
    expect(isBookmarkSort("newest")).toBe(true);
    expect(isBookmarkSort("created_at desc")).toBe(false);
    expect(isBookmarkSort("")).toBe(false);
  });
});

describe("GET /bookmarks — cursor", () => {
  const bookmark = {
    id: "0f2b1c9e-0000-4000-8000-000000000001",
    createdAt: new Date("2026-08-01T10:30:00.000Z"),
    readAt: new Date("2026-08-20T08:00:00.000Z"),
  };

  it("round-trips the three columns every ordering sorts on", () => {
    const cursor = encodeBookmarkCursor("newest", bookmark);
    const decoded = decodeBookmarkCursor(cursor, "newest");

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.cursor.id).toBe(bookmark.id);
    expect(decoded.cursor.createdAt.toISOString()).toBe(
      "2026-08-01T10:30:00.000Z"
    );
    expect(decoded.cursor.readAt?.toISOString()).toBe(
      "2026-08-20T08:00:00.000Z"
    );
  });

  it("keeps an unread row's null read_at null rather than epoch", () => {
    // `recently_read` and `longest_unread` both branch on this being null.
    // Coercing it to a date would silently move the row into the wrong bucket.
    const cursor = encodeBookmarkCursor("recently_read", {
      ...bookmark,
      readAt: null,
    });
    const decoded = decodeBookmarkCursor(cursor, "recently_read");

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.cursor.readAt).toBeNull();
  });

  it("refuses a cursor produced under a different sort", () => {
    const cursor = encodeBookmarkCursor("newest", bookmark);
    const decoded = decodeBookmarkCursor(cursor, "oldest");

    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error).toContain("sort");
  });

  it("refuses a cursor that is not a cursor", () => {
    expect(decodeBookmarkCursor("not-base64-json", "newest").ok).toBe(false);
    expect(
      decodeBookmarkCursor(
        Buffer.from('{"s":"newest"}', "utf8").toString("base64url"),
        "newest"
      ).ok
    ).toBe(false);
  });

  it("is opaque — nothing in it reads as a column a client could forge", () => {
    const cursor = encodeBookmarkCursor("newest", bookmark);
    expect(cursor).not.toContain("created_at");
    expect(cursor).not.toContain("2026-08-01");
  });
});

describe("PATCH /bookmarks/:id — body", () => {
  it("takes the whole tag list, so an undo can restore it exactly", () => {
    const parsed = updateBookmarkSchema.safeParse({
      tags: ["typography", "reading"],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts archive and un-archive", () => {
    expect(updateBookmarkSchema.safeParse({ isArchived: true }).success).toBe(
      true
    );
    expect(updateBookmarkSchema.safeParse({ isArchived: false }).success).toBe(
      true
    );
  });

  it("rejects a blank tag and an empty body", () => {
    expect(updateBookmarkSchema.safeParse({ tags: ["  "] }).success).toBe(false);
    expect(updateBookmarkSchema.safeParse({}).success).toBe(false);
  });

  it("has no way to move a bookmark — that is the refile endpoint's job", () => {
    const parsed = updateBookmarkSchema.safeParse({
      isArchived: true,
      collectionId: "0f2b1c9e-0000-4000-8000-000000000002",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect("collectionId" in parsed.data).toBe(false);
  });
});
