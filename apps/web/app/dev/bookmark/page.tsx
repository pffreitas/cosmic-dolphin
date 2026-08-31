import { notFound } from "next/navigation";

import { BookmarkStates } from "./bookmark-states";

/**
 * `/dev/bookmark` — the bookmark detail page's states, alongside
 * `/dev/patterns` and `/dev/library`.
 *
 * Processing, failed, private link and ready, plus the shared route's variant
 * of the same composition. Reaching any of them through the real route means
 * putting a bookmark into that state first, and two of them are states you
 * cannot ask for.
 *
 * Dev-only, the same way its two siblings are: `NODE_ENV` is inlined at build
 * time, so a production build compiles this to a `notFound()`.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bookmark detail states · dev",
  robots: { index: false, follow: false },
};

export default function DevBookmarkPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <BookmarkStates />;
}
