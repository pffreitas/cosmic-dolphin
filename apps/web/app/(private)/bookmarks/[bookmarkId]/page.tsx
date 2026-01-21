import { BookmarkBody } from "@/components/bookmark/BookmarkBody";
import { BookmarksAPI } from "@/lib/api/bookmarks";
import _ from "lodash";
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
    return <div>Note not found</div>;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookmarkBody bookmark={bookmark} />
    </Suspense>
  );
}
