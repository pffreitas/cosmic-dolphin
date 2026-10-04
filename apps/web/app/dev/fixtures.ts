import type {
  BookmarkLibraryCounts,
  Collection,
} from "@cosmic-dolphin/api-client";

/**
 * The fixture Library every dev gallery shares: the sidebar's collections and
 * counts, and the Library gallery's own rail. One copy, so the sidebar and the
 * list never disagree about how many saves "Design" holds.
 */
export const COLLECTIONS: Collection[] = [
  { id: "design", name: "Design", userId: "u" },
  { id: "typography", name: "Typography & reading UX", userId: "u", parentId: "design" },
  { id: "engineering", name: "Engineering", userId: "u" },
  { id: "agents", name: "Agents", userId: "u", parentId: "engineering" },
  { id: "reading", name: "Reading", userId: "u" },
];

export const COUNTS: BookmarkLibraryCounts = {
  all: 148,
  inbox: 9,
  unread: 34,
  archived: 12,
  collections: [
    { collectionId: "design", count: 21 },
    { collectionId: "typography", count: 14 },
    { collectionId: "engineering", count: 38 },
    { collectionId: "agents", count: 17 },
    { collectionId: "reading", count: 26 },
  ],
};
