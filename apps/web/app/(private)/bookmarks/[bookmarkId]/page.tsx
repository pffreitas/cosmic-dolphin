import { notFound } from "next/navigation";

import { BookmarkDetail } from "@/components/bookmark/detail/bookmark-detail";
import { toDetailModel } from "@/components/bookmark/detail/detail-data";
import { BookmarksAPI } from "@/lib/api/bookmarks";

/**
 * `/bookmarks/[bookmarkId]` — the reading surface, owner's side.
 *
 * The composition lives in `components/bookmark/detail/bookmark-detail.tsx`
 * and is shared with `/s/[slug]`; this route's whole job is to fetch, decide
 * whether there is anything to show, and pick the owner's variant.
 *
 * The fourth state — not found — is a real 404 from `not-found.tsx` rather
 * than a panel rendered at 200, because "there is no bookmark" is not a state
 * of a bookmark page. It is deliberately the same answer for a deleted save
 * and for someone else's: telling a stranger that an id exists but is not
 * theirs is telling them something about another person's library.
 */
interface PageProps {
  params: Promise<{ bookmarkId: string }>;
}

export default async function BookmarkDetailPage({ params }: PageProps) {
  const { bookmarkId } = await params;
  const bookmark = await BookmarksAPI.findById(bookmarkId);

  // `notFound()` rather than a rendered panel: the page has to answer 404,
  // not 200 with an apology in it. The copy and the way back to Library live
  // in this route's `not-found.tsx`.
  if (!bookmark?.id) notFound();

  return <BookmarkDetail model={toDetailModel(bookmark, { mode: "owner" })} />;
}
