import { Suspense } from "react";

import { BookmarksAPI, CollectionsAPI } from "@/lib/api/bookmarks";
import {
  LibraryFallback,
  LibraryView,
} from "@/components/bookmark/library/library-view";
import {
  LIBRARY_PAGE_SIZE,
  LibraryView as LibraryViewParams,
  libraryViewKey,
  parseLibraryView,
} from "@/components/bookmark/library/params";
import { toLibraryItem } from "@/components/bookmark/library/row-data";

/**
 * Library — `/my/library`.
 *
 * Saved-link first, chronological by default, AI-filed, and private: no likes,
 * no comments, no counts, no social context anywhere on this surface
 * (docs/functional-spec/04-library.md).
 *
 * The whole view lives in the query string, so a filtered Library survives a
 * refresh and can be sent to someone.
 */
export const dynamic = "force-dynamic";

type SearchParams = {
  collection_id?: string;
  read_status?: string;
  scope?: string;
  sort?: string;
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = parseLibraryView(params);

  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 sm:px-6">
      {/*
        Keyed on the view so a filter change tears the list down rather than
        animating one collection's rows into another's. The fallback holds the
        real geometry: the rail's labels, the header block, six skeleton rows.
      */}
      <Suspense key={libraryViewKey(view)} fallback={<LibraryFallback view={view} />}>
        <LibraryData view={view} sortExplicit={Boolean(params.sort)} />
      </Suspense>
    </main>
  );
}

async function LibraryData({
  view,
  sortExplicit,
}: {
  view: LibraryViewParams;
  sortExplicit: boolean;
}) {
  // Four independent reads, one round trip's worth of waiting. The rail cannot
  // render without its counts and the list cannot render without its rows, so
  // serialising them would only make the page slower.
  const [page, counts, collections, suggestions] = await Promise.all([
    BookmarksAPI.listPage({
      collection_id: view.collectionId,
      scope: view.scope,
      read_status: view.readStatus,
      sort: view.sort,
      limit: LIBRARY_PAGE_SIZE,
    }),
    BookmarksAPI.counts(),
    CollectionsAPI.list(),
    CollectionsAPI.listSuggestions(),
  ]);

  const now = new Date();

  return (
    <LibraryView
      view={view}
      sortExplicit={sortExplicit}
      items={
        page.ok ? page.bookmarks.map((bookmark) => toLibraryItem(bookmark, now)) : []
      }
      nextCursor={page.ok ? page.nextCursor : undefined}
      error={page.ok ? undefined : page.error}
      counts={counts}
      collections={collections}
      // The endpoint returns only offerable proposals, so the first one is the
      // one to put in front of the user. More than one at a time would turn the
      // rail into a queue of decisions.
      suggestion={suggestions[0]}
    />
  );
}
