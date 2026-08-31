import { describe, expect, it } from "vitest";
import {
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
} from "@cosmic-dolphin/api-client";

import {
  libraryEmptyCopy,
  libraryHeading,
  libraryHref,
  parseLibraryView,
} from "../params";

describe("parseLibraryView", () => {
  it("defaults to All saves, all read states, chronological", () => {
    expect(parseLibraryView({})).toEqual({
      scope: BookmarkScope.All,
      collectionId: undefined,
      readStatus: BookmarkReadStatus.All,
      sort: BookmarkSort.Newest,
    });
  });

  it("reads the read-status filter back off the URL", () => {
    // The filter has to survive a refresh and be shareable — that is the whole
    // reason it lives in the query string.
    expect(parseLibraryView({ read_status: "unread" }).readStatus).toBe(
      BookmarkReadStatus.Unread
    );
  });

  it("falls back rather than failing on a hand-edited query", () => {
    const view = parseLibraryView({
      read_status: "maybe",
      sort: "alphabetical",
      scope: "everything",
    });
    expect(view.readStatus).toBe(BookmarkReadStatus.All);
    expect(view.sort).toBe(BookmarkSort.Newest);
    expect(view.scope).toBe(BookmarkScope.All);
  });

  it("lets a named collection win over a scope", () => {
    const view = parseLibraryView({ collection_id: "abc", scope: "archive" });
    expect(view.collectionId).toBe("abc");
    expect(view.scope).toBe(BookmarkScope.All);
  });
});

describe("libraryHref", () => {
  it("leaves the defaults out, so All · All · Newest is the bare route", () => {
    expect(
      libraryHref({
        scope: BookmarkScope.All,
        readStatus: BookmarkReadStatus.All,
        sort: BookmarkSort.Newest,
      })
    ).toBe("/my/library");
  });

  it("round-trips through parseLibraryView", () => {
    const view = {
      scope: BookmarkScope.All,
      collectionId: "col-1",
      readStatus: BookmarkReadStatus.Unread,
      sort: BookmarkSort.LongestUnread,
    };
    const href = libraryHref(view);
    const params = Object.fromEntries(
      new URLSearchParams(href.split("?")[1] ?? "")
    );
    expect(parseLibraryView(params)).toEqual(view);
  });

  it("keeps chronological one click away from any other sort", () => {
    expect(libraryHref({ sort: BookmarkSort.Newest })).toBe("/my/library");
  });
});

describe("libraryHeading", () => {
  it("names the rail row it is showing", () => {
    expect(
      libraryHeading({
        scope: BookmarkScope.Inbox,
        readStatus: BookmarkReadStatus.All,
        sort: BookmarkSort.Newest,
      }).title
    ).toBe("Inbox");
    expect(
      libraryHeading(
        {
          scope: BookmarkScope.All,
          collectionId: "c",
          readStatus: BookmarkReadStatus.All,
          sort: BookmarkSort.Newest,
        },
        "Typography"
      ).title
    ).toBe("Typography");
  });
});

describe("libraryEmptyCopy", () => {
  const base = {
    scope: BookmarkScope.All,
    readStatus: BookmarkReadStatus.All,
    sort: BookmarkSort.Newest,
  };

  it("gives an empty library, an empty collection and an empty filter three different sentences", () => {
    const emptyLibrary = libraryEmptyCopy(base, 0);
    const emptyCollection = libraryEmptyCopy(
      { ...base, collectionId: "c" },
      40,
      "Typography"
    );
    const emptyFilter = libraryEmptyCopy(
      { ...base, readStatus: BookmarkReadStatus.Unread },
      40
    );

    const titles = [
      emptyLibrary.title,
      emptyCollection.title,
      emptyFilter.title,
    ];
    expect(new Set(titles).size).toBe(3);
    expect(emptyCollection.title).toContain("Typography");
    expect(emptyFilter.title).toContain("unread");
  });

  it("offers the first-save CTA only when there is genuinely nothing saved", () => {
    expect(libraryEmptyCopy(base, 0).firstSave).toBe(true);
    expect(libraryEmptyCopy(base, 12).firstSave).toBe(false);
    // An empty archive is not a new user.
    expect(
      libraryEmptyCopy({ ...base, scope: BookmarkScope.Archive }, 0).firstSave
    ).toBe(false);
  });
});
