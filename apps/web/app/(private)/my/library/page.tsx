import { BookmarksAPI } from "@/lib/api/bookmarks";
import { Bookmark, BookmarkReadStatus } from "@cosmic-dolphin/api-client";
import Link from "next/link";
import { Suspense } from "react";
import { Bookmark as BookmarkIcon } from "lucide-react";
import { BookmarkListCard } from "@/components/bookmark/bookmark-list-card";

const readFilters: {
  label: string;
  value: BookmarkReadStatus;
}[] = [
  { label: "All", value: BookmarkReadStatus.All },
  { label: "Unread", value: BookmarkReadStatus.Unread },
  { label: "Read", value: BookmarkReadStatus.Read },
];

function normalizeReadStatus(
  readStatus?: string
): BookmarkReadStatus {
  if (readStatus === BookmarkReadStatus.Unread) {
    return BookmarkReadStatus.Unread;
  }
  if (readStatus === BookmarkReadStatus.Read) {
    return BookmarkReadStatus.Read;
  }
  return BookmarkReadStatus.All;
}

function buildLibraryFilterHref(
  readStatus: BookmarkReadStatus,
  collectionId?: string
) {
  const params = new URLSearchParams();
  if (collectionId) params.set("collection_id", collectionId);
  if (readStatus !== BookmarkReadStatus.All) {
    params.set("read_status", readStatus);
  }
  const query = params.toString();
  return query ? `/my/library?${query}` : "/my/library";
}

async function BookmarksList({
  searchParams,
}: {
  searchParams: { collection_id?: string; read_status?: string };
}) {
  const readStatus = normalizeReadStatus(searchParams.read_status);
  const bookmarks = await BookmarksAPI.list({
    collection_id: searchParams.collection_id,
    read_status: readStatus,
  });

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <BookmarkIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No bookmarks found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          {readStatus === BookmarkReadStatus.Read
            ? "Bookmarks you mark as read will stay here in your complete library."
            : "Start saving articles and pages to build your personal library."}
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
          showReadStatus
        />
      ))}
    </div>
  );
}

const LoadingBookmarks = () => (
  <div className="divide-y divide-gray-100 dark:divide-gray-800">
    {Array.from({ length: 5 }).map((_, i) => (
      <article
        key={i}
        className="group py-6 border-b border-gray-100 dark:border-gray-800 last:border-b-0 animate-pulse"
      >
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-sm bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="space-y-1">
              <div className="h-6 sm:h-7 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-6 sm:h-7 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-12 sm:h-14 w-full bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="flex flex-wrap gap-1.5 mt-1">
              <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-md" />
              <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-md" />
              <div className="h-5 w-14 bg-gray-100 dark:bg-gray-800 rounded-md" />
            </div>
          </div>
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-md bg-gray-200 dark:bg-gray-700 shrink-0" />
        </div>
      </article>
    ))}
  </div>
);

export default async function Index({
  searchParams,
}: {
  searchParams: Promise<{ collection_id?: string; read_status?: string }>;
}) {
  const params = await searchParams;
  const readStatus = normalizeReadStatus(params.read_status);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All saved bookmarks, including items already read.
          </p>
        </div>
        <nav className="flex rounded-md border border-gray-200 bg-white p-1 text-sm dark:border-gray-800 dark:bg-gray-950">
          {readFilters.map((filter) => {
            const isActive = readStatus === filter.value;
            return (
              <Link
                key={filter.value}
                href={buildLibraryFilterHref(
                  filter.value,
                  params.collection_id
                )}
                className={`rounded px-3 py-1.5 font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-900"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Suspense fallback={<LoadingBookmarks />}>
        <BookmarksList searchParams={params} />
      </Suspense>
    </main>
  );
}
