import type { Bookmark, FeedItem, Digest } from "@cosmic-dolphin/api-client";
import { buildEditions } from "../home-editions";
jest.mock("@/lib/mobile-api", () => ({
  nativeBookmark: (bookmark: Bookmark) => ({
    ...bookmark,
    createdAt: bookmark.createdAt.toISOString(),
    updatedAt: bookmark.updatedAt.toISOString(),
  }),
}));
const bookmark = (id: string, tags: string[]): Bookmark => ({
  id,
  sourceUrl: `https://example.com/${id}`,
  userId: "someone",
  createdAt: new Date("2026-10-01"),
  updatedAt: new Date("2026-10-01"),
  title: id,
  cosmicTags: tags,
});
const item = (value: Bookmark): FeedItem => ({
  type: "followed_save",
  bookmark: value,
});
describe("personalized Home editions", () => {
  it("unifies AI and personal-growth tag aliases without repeating a link in a section", () => {
    const value = bookmark("one", ["AI", "artificial intelligence", "habits"]);
    const editions = buildEditions([
      item(value),
      item(value),
      item(bookmark("two", ["machine learning"])),
    ]);
    expect(
      editions
        .find((edition) => edition.title === "Latest on AI")
        ?.bookmarks.map((value) => value.id),
    ).toEqual(["one", "two"]);
    expect(
      editions
        .find((edition) => edition.title === "Self improvement")
        ?.bookmarks.map((value) => value.id),
    ).toEqual(["one"]);
  });
  it("orders by explicit interests while retaining adjacent discoveries", () => {
    const editions = buildEditions(
      [item(bookmark("ai", ["AI"])), item(bookmark("design", ["Design"]))],
      ["Design"],
    );
    expect(editions.map((edition) => edition.topic)).toEqual(["Design", "AI"]);
  });
  it("retains server-authored digests and all their sources without inventing bookmarks", () => {
    const digest = {
      id: "digest",
      title: "A real connection",
      summary: "From the server",
      sources: [
        {
          bookmarkId: "private",
          title: "Private source",
          domain: "example.com",
          url: "https://example.com",
        },
      ],
    } as Digest;
    const editions = buildEditions([
      { type: "digest", digest },
      { type: "digest", digest },
    ]);
    expect(editions).toHaveLength(1);
    expect(editions[0].digest?.sources).toEqual(digest.sources);
    expect(editions[0].bookmarks).toEqual([]);
  });
  it("returns an honest empty state when no recommendations exist", () => {
    expect(buildEditions([])).toEqual([]);
  });
});
