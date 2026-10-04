"use client";

import * as React from "react";
import {
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
  CollectionSuggestion,
} from "@cosmic-dolphin/api-client";

import { DevShell } from "@/app/dev/dev-shell";
import { COLLECTIONS, COUNTS } from "@/app/dev/fixtures";
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

  return (
    <DevShell
      title="Library states"
      currentPath="/my/library"
      states={STATES}
      state={state}
      onStateChange={setState}
    >
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
    </DevShell>
  );
}
