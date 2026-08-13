import { BookmarksAPI } from "@/lib/api/bookmarks";
import { Bookmark } from "@cosmic-dolphin/api-client";
import { Suspense } from "react";
import { InboxIcon } from "lucide-react";
import { BookmarkListCard } from "@/components/bookmark/bookmark-list-card";

async function FeedList() {
  const bookmarks = await BookmarksAPI.feed();

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <InboxIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          You&apos;re caught up
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Unread bookmarks appear here. Read bookmarks stay available in your
          library.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {bookmarks.map((bookmark: Bookmark) => (
        <BookmarkListCard
          key={bookmark.id}
          bookmark={bookmark}
          showReadToggle
        />
      ))}
    </div>
  );
}

const LoadingFeed = () => (
  <div className="divide-y divide-gray-100 dark:divide-gray-800">
    {Array.from({ length: 5 }).map((_, i) => (
      <article
        key={i}
        className="py-6 border-b border-gray-100 dark:border-gray-800 last:border-b-0 animate-pulse"
      >
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-sm bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-7 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-md bg-gray-200 dark:bg-gray-700 shrink-0" />
        </div>
      </article>
    ))}
  </div>
);

export default async function Index() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Home
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your unread bookmark feed.
        </p>
      </div>
      <Suspense fallback={<LoadingFeed />}>
        <FeedList />
      </Suspense>
    </main>
  );
}
