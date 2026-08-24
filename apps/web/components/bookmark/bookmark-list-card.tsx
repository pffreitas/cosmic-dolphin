import { Bookmark } from "@cosmic-dolphin/api-client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LockIcon } from "lucide-react";
import { BookmarkReadToggleButton } from "@/components/bookmark/bookmark-read-toggle-button";

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "";
  }
}

interface BookmarkListCardProps {
  bookmark: Bookmark;
  showReadStatus?: boolean;
  showReadToggle?: boolean;
}

export function BookmarkListCard({
  bookmark,
  showReadStatus = false,
  showReadToggle = true,
}: BookmarkListCardProps) {
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
  const displayName = collectionName || siteName;
  const isRead = bookmark.isRead ?? Boolean(bookmark.readAt);

  return (
    <article className="group py-6 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {displayName && (
              <>
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
              </>
            )}
            {showReadStatus && isRead && (
              <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
                Read
              </Badge>
            )}
          </div>

          <Link href={`/bookmarks/${bookmark.id}`} className="block">
            <h2 className="flex items-start gap-1.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
              {bookmark.isPrivateLink && (
                <LockIcon className="mt-1 size-4 shrink-0 text-gray-400 dark:text-gray-500" />
              )}
              {bookmark.title || "Untitled"}
            </h2>
          </Link>

          {description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
              {description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {bookmark.cosmicTags?.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2 py-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {tag}
              </Badge>
            ))}
            {showReadToggle && (
              <BookmarkReadToggleButton
                bookmarkId={bookmark.id}
                initialIsRead={isRead}
                compact
                className="ml-auto"
              />
            )}
          </div>
        </div>

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
}
