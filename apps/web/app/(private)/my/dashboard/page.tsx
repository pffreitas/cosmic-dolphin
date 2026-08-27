import { BookmarksAPI } from "@/lib/api/bookmarks";
import { Suspense } from "react";
import { InboxIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  LibraryList,
  LibraryRow,
  LibraryRowSkeleton,
} from "@/components/bookmark/library-row";
import { toLibraryItem } from "@/components/bookmark/library/row-data";

/**
 * Home, still the plain unread list.
 *
 * The ranked feed is D11's; this file only moved off the card component the
 * Library replaced, onto the same library row, so no card survives anywhere in
 * the tree. Nothing else about this page has been decided here.
 */
async function FeedList() {
  const bookmarks = await BookmarksAPI.feed();

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <EmptyState
        ground
        icon={InboxIcon}
        title="You're caught up."
        description="Unread saves appear here. Read ones stay available in your library."
      />
    );
  }

  const now = new Date();

  return (
    <LibraryList>
      {bookmarks.map((bookmark) => {
        const item = toLibraryItem(bookmark, now);
        return (
          <LibraryRow
            key={item.id}
            href={item.href}
            title={item.title}
            summary={item.summary}
            collectionPath={item.collectionPath}
            filing={item.filing}
            unread={item.unread}
            tags={item.tags}
            domain={item.domain}
            savedAt={item.savedAt}
            readingTime={item.readingTime}
            thumbnailUrl={item.thumbnailUrl}
            privateLink={item.privateLink}
            summaryLoading={item.summaryLoading}
          />
        );
      })}
    </LibraryList>
  );
}

const LoadingFeed = () => (
  <LibraryList>
    {Array.from({ length: 5 }).map((_, index) => (
      <LibraryRowSkeleton key={index} />
    ))}
  </LibraryList>
);

export default async function Index() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="m-0 font-serif text-[22px] font-semibold leading-[1.25] text-fg">
          Home
        </h1>
        <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
          Your unread saves.
        </p>
      </div>
      <Suspense fallback={<LoadingFeed />}>
        <FeedList />
      </Suspense>
    </main>
  );
}
