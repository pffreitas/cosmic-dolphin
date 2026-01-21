import { BookmarksAPI } from "@/lib/api/bookmarks";
import { Bookmark } from "@cosmic-dolphin/api-client";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Bookmark as BookmarkIcon } from "lucide-react";

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "";
  }
}

const BookmarkCard = ({ bookmark }: { bookmark: Bookmark }) => {
  // Get the immediate (last) collection from the path
  const immediateCollection = bookmark.collectionPath?.length
    ? bookmark.collectionPath[bookmark.collectionPath.length - 1]
    : null;
  const collectionName = immediateCollection?.name;

  const siteName =
    bookmark.metadata?.openGraph?.siteName ||
    extractDomain(bookmark.sourceUrl || "");
  const image = bookmark.metadata?.openGraph?.image;
  const description =
    bookmark.cosmicBriefSummary ||
    bookmark.metadata?.openGraph?.description ||
    "";

  // Display collection name if available, otherwise fall back to site name
  const displayName = collectionName || siteName;

  return (
    <article className="group py-6 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="flex gap-6">
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Publication header */}
          {displayName && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-300 dark:to-gray-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white dark:text-gray-900 uppercase">
                  {displayName.charAt(0)}
                </span>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                In{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {displayName}
                </span>
              </span>
            </div>
          )}

          {/* Title */}
          <Link href={`/bookmarks/${bookmark.id}`} className="block">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
              {bookmark.title}
            </h2>
          </Link>

          {/* Description */}
          {description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
              {description}
            </p>
          )}

          {/* Tags */}
          {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {bookmark.cosmicTags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail */}
        {image && (
          <Link href={`/bookmarks/${bookmark.id}`} className="shrink-0">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={image}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </Link>
        )}
      </div>
    </article>
  );
};

async function BookmarksList() {
  const bookmarks = await BookmarksAPI.list();

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <BookmarkIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No bookmarks yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Start saving articles and pages to build your personal library.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {bookmarks.map((bookmark: Bookmark) => (
        <BookmarkCard key={bookmark.id} bookmark={bookmark} />
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
            {/* Publication header skeleton - matches: flex items-center gap-2 text-sm */}
            <div className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-sm bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            {/* Title skeleton - matches: text-lg sm:text-xl leading-tight line-clamp-2 */}
            <div className="space-y-1">
              <div className="h-6 sm:h-7 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-6 sm:h-7 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            {/* Description skeleton - matches: text-sm sm:text-base leading-relaxed line-clamp-2 */}
            <div className="h-12 sm:h-14 w-full bg-gray-100 dark:bg-gray-800 rounded" />
            {/* Tags skeleton - matches: flex flex-wrap gap-1.5 mt-1 with Badge */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-md" />
              <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-md" />
              <div className="h-5 w-14 bg-gray-100 dark:bg-gray-800 rounded-md" />
            </div>
          </div>
          {/* Thumbnail skeleton - matches: w-24 h-24 sm:w-32 sm:h-32 rounded-md */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-md bg-gray-200 dark:bg-gray-700 shrink-0" />
        </div>
      </article>
    ))}
  </div>
);

export default function Index() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Suspense fallback={<LoadingBookmarks />}>
        <BookmarksList />
      </Suspense>
    </main>
  );
}
