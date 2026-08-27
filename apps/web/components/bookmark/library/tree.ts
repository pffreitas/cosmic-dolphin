import {
  BookmarkLibraryCounts,
  BookmarkScope,
  BookmarkReadStatus,
  Collection,
} from "@cosmic-dolphin/api-client";

import { LibraryView, libraryHref } from "./params";

/**
 * A row of the Library rail.
 *
 * `collectionId` doubles as the drop target: `undefined` means the row takes
 * no drops (a saved filter is not a place a bookmark can live), `null` means
 * dropping there moves the bookmark to Inbox.
 */
export interface LibraryTreeNode {
  key: string;
  label: string;
  href: string;
  count: number;
  active: boolean;
  /** `undefined` — not a drop target. `null` — drops move to Inbox. */
  collectionId?: string | null;
  children: LibraryTreeNode[];
}

export interface LibraryTree {
  /** All saves, Inbox. */
  top: LibraryTreeNode[];
  /** The user's collections, nested to two levels. */
  collections: LibraryTreeNode[];
  /** Read later, Archive — saved filters, not collections. */
  filters: LibraryTreeNode[];
}

/**
 * The rail, assembled.
 *
 * The two-level cap is enforced here as well as in the API: a collection whose
 * parent is itself nested is hoisted to the root rather than dropped, because
 * a collection the user cannot see is worse than one shown a level too high.
 *
 * Parent counts include their children. A parent reading `0` while holding two
 * children with nine saves between them looks like a bug, and the number
 * people want from a folder is how much is under it.
 */
export function buildLibraryTree(
  collections: Collection[],
  counts: BookmarkLibraryCounts | null,
  view: LibraryView
): LibraryTree {
  const direct = new Map<string, number>();
  for (const entry of counts?.collections ?? []) {
    direct.set(entry.collectionId, entry.count);
  }

  const byId = new Map(collections.map((collection) => [collection.id, collection]));
  const roots: Collection[] = [];
  const childrenOf = new Map<string, Collection[]>();

  for (const collection of collections) {
    const parentId = collection.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    // A parent that is itself nested would make a third level. Hoist.
    const nestable = parent && !parent.parentId;

    if (parent && nestable) {
      const siblings = childrenOf.get(parent.id) ?? [];
      siblings.push(collection);
      childrenOf.set(parent.id, siblings);
    } else {
      roots.push(collection);
    }
  }

  const byName = (a: Collection, b: Collection) => a.name.localeCompare(b.name);

  const collectionNodes = roots.sort(byName).map((collection) => {
    const children = (childrenOf.get(collection.id) ?? [])
      .sort(byName)
      .map((child) => collectionNode(child, direct.get(child.id) ?? 0, [], view));

    return collectionNode(
      collection,
      direct.get(collection.id) ?? 0,
      children,
      view
    );
  });

  const noCollection = !view.collectionId;

  return {
    top: [
      {
        key: "all",
        label: "All saves",
        href: libraryHref({
          scope: BookmarkScope.All,
          readStatus: view.readStatus,
          sort: view.sort,
        }),
        count: counts?.all ?? 0,
        active: noCollection && view.scope === BookmarkScope.All,
        children: [],
      },
      {
        key: "inbox",
        label: "Inbox",
        href: libraryHref({
          scope: BookmarkScope.Inbox,
          readStatus: view.readStatus,
          sort: view.sort,
        }),
        count: counts?.inbox ?? 0,
        active: noCollection && view.scope === BookmarkScope.Inbox,
        // Inbox is `collection_id IS NULL`, so dropping here un-files.
        collectionId: null,
        children: [],
      },
    ],
    collections: collectionNodes,
    filters: [
      {
        key: "read-later",
        // A saved filter, not a collection — see 04-library.md § Collections.
        label: "Read later",
        href: libraryHref({
          scope: BookmarkScope.All,
          readStatus: BookmarkReadStatus.Unread,
          sort: view.sort,
        }),
        count: counts?.unread ?? 0,
        active:
          noCollection &&
          view.scope === BookmarkScope.All &&
          view.readStatus === BookmarkReadStatus.Unread,
        children: [],
      },
      {
        key: "archive",
        label: "Archive",
        href: libraryHref({
          scope: BookmarkScope.Archive,
          readStatus: view.readStatus,
          sort: view.sort,
        }),
        count: counts?.archived ?? 0,
        active: noCollection && view.scope === BookmarkScope.Archive,
        children: [],
      },
    ],
  };
}

function collectionNode(
  collection: Collection,
  ownCount: number,
  children: LibraryTreeNode[],
  view: LibraryView
): LibraryTreeNode {
  return {
    key: collection.id,
    label: collection.name,
    href: libraryHref({
      collectionId: collection.id,
      readStatus: view.readStatus,
      sort: view.sort,
    }),
    count:
      ownCount + children.reduce((total, child) => total + child.count, 0),
    active: view.collectionId === collection.id,
    collectionId: collection.id,
    children,
  };
}

/** Every collection, flattened, for the "Move to" menus. */
export function flattenCollections(
  tree: LibraryTree
): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];

  for (const node of tree.collections) {
    if (node.collectionId) {
      out.push({ id: node.collectionId, name: node.label, depth: 0 });
    }
    for (const child of node.children) {
      if (child.collectionId) {
        out.push({ id: child.collectionId, name: child.label, depth: 1 });
      }
    }
  }

  return out;
}
