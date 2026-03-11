import { BookmarkBody } from "@/components/bookmark/BookmarkBody";
import { BookmarkDetailSkeleton } from "@/components/bookmark/BookmarkDetailSkeleton";
import { BookmarksAPI } from "@/lib/api/bookmarks";
import { BookmarkXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    bookmarkId: string;
  }>;
}

export default async function Index({ params }: PageProps) {
  const { bookmarkId } = await params;

  const bookmark = await BookmarksAPI.findById(bookmarkId);

  if (!bookmark || !bookmark.id) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <BookmarkXIcon className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Bookmark not found
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This bookmark may have been deleted or you don&apos;t have access to
            it.
          </p>
        </div>
        <Link
          href="/my/library"
          className="mt-2 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<BookmarkDetailSkeleton />}>
      <BookmarkBody bookmark={bookmark} />
    </Suspense>
  );
}
