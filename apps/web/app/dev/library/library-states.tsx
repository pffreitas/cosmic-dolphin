"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  BookmarkLibraryCounts,
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
  Collection,
  CollectionSuggestion,
} from "@cosmic-dolphin/api-client";

import { Button } from "@/components/ui/button";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import {
  LibraryFallback,
  LibraryView,
} from "@/components/bookmark/library/library-view";
import type { LibraryItem } from "@/components/bookmark/library/row-data";
import type { LibraryView as LibraryViewParams } from "@/components/bookmark/library/params";

/* ---------------------------------------------------------------------------
   Fixtures.

   Plain props, not the API: every state below has to be reachable on demand
   rather than by waiting for the pipeline to happen to be in it. The rows are
   the real `LibraryView`, so what this page shows is what `/my/library` shows.
   --------------------------------------------------------------------------- */

const COLLECTIONS: Collection[] = [
  { id: "design", name: "Design", userId: "u" },
  { id: "typography", name: "Typography & reading UX", userId: "u", parentId: "design" },
  { id: "engineering", name: "Engineering", userId: "u" },
  { id: "agents", name: "Agents", userId: "u", parentId: "engineering" },
  { id: "reading", name: "Reading", userId: "u" },
];

const COUNTS: BookmarkLibraryCounts = {
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

const SUGGESTION: CollectionSuggestion = {
  id: "s1",
  userId: "u",
  name: "Typography & reading UX",
  bookmarkIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  status: "pending",
  createdAt: new Date("2026-08-25T09:00:00Z"),
};

function item(overrides: Partial<LibraryItem> & { id: string }): LibraryItem {
  return {
    href: `/bookmarks/${overrides.id}`,
    title: "Untitled",
    collectionId: null,
    collectionPath: [],
    filing: false,
    unread: false,
    tags: [],
    savedAt: "2d ago",
    privateLink: false,
    summaryLoading: false,
    archived: false,
    ...overrides,
  };
}

const ITEMS: LibraryItem[] = [
  item({
    id: "1",
    title: "The unreasonable effectiveness of memory in agent design",
    summary:
      "Long-lived agents fail on retrieval, not reasoning. A short note on why context windows are the wrong place to put a memory.",
    collectionId: "agents",
    collectionPath: [
      { id: "engineering", name: "Engineering", href: "/my/library?collection_id=engineering" },
      { id: "agents", name: "Agents", href: "/my/library?collection_id=agents" },
    ],
    unread: true,
    tags: ["agents", "memory", "architecture", "retrieval"],
    domain: "every.to",
    savedAt: "2d ago",
    readingTime: "9 min",
  }),
  item({
    id: "2",
    title: "Reading on screens: what twenty years of eye-tracking actually showed",
    summary:
      "Measure, leading, and the paragraph as a unit of attention. The findings are older and duller than the discourse.",
    collectionId: "typography",
    collectionPath: [
      { id: "design", name: "Design", href: "/my/library?collection_id=design" },
      {
        id: "typography",
        name: "Typography & reading UX",
        href: "/my/library?collection_id=typography",
      },
    ],
    tags: ["typography", "research"],
    domain: "stratechery.com",
    savedAt: "3d ago",
    readingTime: "6 min",
  }),
  item({
    id: "3",
    title: "A note I saved from a private wiki",
    privateLink: true,
    unread: true,
    collectionId: "reading",
    collectionPath: [
      { id: "reading", name: "Reading", href: "/my/library?collection_id=reading" },
    ],
    domain: "notion.so",
    savedAt: "6h ago",
  }),
  item({
    id: "4",
    // Still filing: the breadcrumb reads Inbox with the AI *filing…* marker,
    // and the summary has not landed yet.
    title: "Retrieval-augmented generation for long-horizon tasks",
    filing: true,
    summaryLoading: true,
    unread: true,
    domain: "arxiv.org",
    savedAt: "just now",
  }),
  item({
    id: "5",
    title: "Why folder trees stop working at three levels",
    summary:
      "Every filing system that survives contact with real use is two levels deep and searchable.",
    tags: ["organisation"],
    domain: "signalvnoise.com",
    savedAt: "1w ago",
    readingTime: "4 min",
  }),
];

const VIEWS: Record<string, LibraryViewParams> = {
  all: {
    scope: BookmarkScope.All,
    readStatus: BookmarkReadStatus.All,
    sort: BookmarkSort.Newest,
  },
  collection: {
    scope: BookmarkScope.All,
    collectionId: "typography",
    readStatus: BookmarkReadStatus.All,
    sort: BookmarkSort.Newest,
  },
  filter: {
    scope: BookmarkScope.All,
    readStatus: BookmarkReadStatus.Unread,
    sort: BookmarkSort.Newest,
  },
};

type StateKey =
  | "populated"
  | "loading"
  | "empty-library"
  | "empty-collection"
  | "empty-filter"
  | "error";

const STATES: { value: StateKey; label: string }[] = [
  { value: "populated", label: "Populated" },
  { value: "loading", label: "Loading" },
  { value: "empty-library", label: "Empty library" },
  { value: "empty-collection", label: "Empty collection" },
  { value: "empty-filter", label: "Empty filter" },
  { value: "error", label: "Error" },
];

/**
 * `/dev/library` — the Library's state gallery.
 *
 * Six skeleton rows, three distinct empty states, the error panel, and a
 * populated list carrying a filing-in-progress row, a private link, read and
 * unread rows, and a two-level breadcrumb. The theme switch is here so both
 * themes can be checked without leaving the page.
 */
export function LibraryStates() {
  const [state, setState] = React.useState<StateKey>("populated");
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="m-0 font-serif text-[22px] font-semibold leading-[1.25] text-fg">
            Library states
          </h1>
          <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            The real components on fixture data. Dev only.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? "Light" : "Dark"}
        </Button>
      </div>

      <div className="py-4">
        <Segmented
          aria-label="Library state"
          value={state}
          onValueChange={(value) => setState(value as StateKey)}
        >
          {STATES.map((option) => (
            <SegmentedItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {state === "loading" ? (
        <LibraryFallback view={VIEWS.all} />
      ) : (
        <LibraryView
          key={state}
          sortExplicit
          view={
            state === "empty-collection"
              ? VIEWS.collection
              : state === "empty-filter"
                ? VIEWS.filter
                : VIEWS.all
          }
          items={state === "populated" ? ITEMS : []}
          counts={
            state === "empty-library" ? { ...COUNTS, all: 0, inbox: 0, unread: 0, archived: 0 } : COUNTS
          }
          collections={COLLECTIONS}
          suggestion={SUGGESTION}
          error={state === "error" ? "We couldn't load your library." : undefined}
        />
      )}
    </div>
  );
}
