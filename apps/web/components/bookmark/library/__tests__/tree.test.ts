import { describe, expect, it } from "vitest";
import {
  BookmarkLibraryCounts,
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
  Collection,
} from "@cosmic-dolphin/api-client";

import { buildLibraryTree, flattenCollections } from "../tree";

const view = {
  scope: BookmarkScope.All,
  readStatus: BookmarkReadStatus.All,
  sort: BookmarkSort.Newest,
};

function collection(
  id: string,
  name: string,
  parentId?: string
): Collection {
  return { id, name, userId: "u", parentId };
}

const counts: BookmarkLibraryCounts = {
  all: 42,
  inbox: 7,
  unread: 12,
  archived: 3,
  collections: [
    { collectionId: "design", count: 4 },
    { collectionId: "typography", count: 5 },
  ],
};

describe("buildLibraryTree", () => {
  it("lays out the rail in the order the spec fixes", () => {
    const tree = buildLibraryTree([], counts, view);
    expect(tree.top.map((node) => node.label)).toEqual(["All saves", "Inbox"]);
    expect(tree.filters.map((node) => node.label)).toEqual([
      "Read later",
      "Archive",
    ]);
  });

  it("carries the counts the rail renders", () => {
    const tree = buildLibraryTree([], counts, view);
    expect(tree.top[0].count).toBe(42);
    expect(tree.top[1].count).toBe(7);
    expect(tree.filters[0].count).toBe(12);
    expect(tree.filters[1].count).toBe(3);
  });

  it("rolls a child's saves into its parent's count", () => {
    const tree = buildLibraryTree(
      [collection("design", "Design"), collection("typography", "Typography", "design")],
      counts,
      view
    );
    expect(tree.collections).toHaveLength(1);
    expect(tree.collections[0].count).toBe(9);
    expect(tree.collections[0].children[0].count).toBe(5);
  });

  it("hoists a third level rather than hiding it", () => {
    // The tree is capped at two levels. A collection whose parent is itself
    // nested has to go somewhere the user can reach.
    const tree = buildLibraryTree(
      [
        collection("a", "A"),
        collection("b", "B", "a"),
        collection("c", "C", "b"),
      ],
      counts,
      view
    );
    const roots = tree.collections.map((node) => node.label);
    expect(roots).toContain("C");
    expect(tree.collections.find((n) => n.label === "A")?.children).toHaveLength(
      1
    );
  });

  it("marks exactly one row active", () => {
    const inbox = buildLibraryTree([], counts, {
      ...view,
      scope: BookmarkScope.Inbox,
    });
    const active = [...inbox.top, ...inbox.filters].filter((n) => n.active);
    expect(active.map((n) => n.label)).toEqual(["Inbox"]);
  });

  it("makes Read later the unread filter, not a collection", () => {
    const tree = buildLibraryTree([], counts, view);
    const readLater = tree.filters[0];
    expect(readLater.href).toContain("read_status=unread");
    // Not a place a bookmark can live, so it takes no drops.
    expect(readLater.collectionId).toBeUndefined();
  });

  it("makes Inbox a drop target that un-files", () => {
    const tree = buildLibraryTree([], counts, view);
    expect(tree.top[1].collectionId).toBeNull();
  });

  it("keeps the read-status filter when moving between collections", () => {
    const tree = buildLibraryTree([collection("design", "Design")], counts, {
      ...view,
      readStatus: BookmarkReadStatus.Unread,
    });
    expect(tree.collections[0].href).toContain("read_status=unread");
  });
});

describe("flattenCollections", () => {
  it("lists parents and children with their depth, for the Move to menu", () => {
    const tree = buildLibraryTree(
      [collection("design", "Design"), collection("typography", "Typography", "design")],
      counts,
      view
    );
    expect(flattenCollections(tree)).toEqual([
      { id: "design", name: "Design", depth: 0 },
      { id: "typography", name: "Typography", depth: 1 },
    ]);
  });
});
