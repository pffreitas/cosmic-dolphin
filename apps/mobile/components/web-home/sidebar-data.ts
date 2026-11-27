import type {
  BookmarkLibraryCounts,
  Collection,
} from "@cosmic-dolphin/api-client";

/** Web's two-level collection tree: alphabetic, parent totals include children. */
export function sidebarCollections(
  collections: Collection[],
  counts: BookmarkLibraryCounts | null,
) {
  const byId = new Map(collections.map((c) => [c.id, c]));
  const direct = new Map(
    counts?.collections.map((c) => [c.collectionId, c.count]),
  );
  const roots: Collection[] = [];
  const children = new Map<string, Collection[]>();
  for (const collection of collections) {
    const parent = collection.parentId
      ? byId.get(collection.parentId)
      : undefined;
    if (parent && !parent.parentId)
      children.set(parent.id, [...(children.get(parent.id) ?? []), collection]);
    else roots.push(collection); // Orphans and third levels are visible at the root.
  }
  const byName = (a: Collection, b: Collection) => a.name.localeCompare(b.name);
  return roots.sort(byName).map((collection) => {
    const nested = (children.get(collection.id) ?? [])
      .sort(byName)
      .map((child) => ({ ...child, count: direct.get(child.id) ?? 0 }));
    return {
      ...collection,
      children: nested,
      count:
        (direct.get(collection.id) ?? 0) +
        nested.reduce((sum, child) => sum + child.count, 0),
    };
  });
}
export type SidebarLibraryQuery = {
  scope?: "all" | "inbox" | "archive";
  readStatus?: "all" | "read" | "unread";
  collectionId?: string;
  name?: string;
};
export function sidebarLibraryRows(counts: BookmarkLibraryCounts | null) {
  return [
    {
      key: "all",
      label: "All saves",
      count: counts?.all,
      query: { scope: "all", readStatus: "all" },
    },
    {
      key: "inbox",
      label: "Inbox",
      count: counts?.inbox,
      query: { scope: "inbox", readStatus: "all" },
    },
    {
      key: "read-later",
      label: "Read later",
      count: counts?.unread,
      query: { scope: "all", readStatus: "unread" },
    },
    {
      key: "archive",
      label: "Archive",
      count: counts?.archived,
      query: { scope: "archive", readStatus: "all" },
    },
  ] as const;
}
