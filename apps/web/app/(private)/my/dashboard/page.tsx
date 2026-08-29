import { Suspense } from "react";
import { FeedScope } from "@cosmic-dolphin/api-client";

import { BookmarksAPI } from "@/lib/api/bookmarks";
import { FeedAPI } from "@/lib/api/feed";
import { HomeFallback, HomeView } from "@/components/feed/home-view";
import { parseFeedScope, toFeedEntries } from "@/components/feed/feed-data";
import type { HomeRailProps } from "@/components/feed/home-rail";

/**
 * Home — `/my/dashboard`, the ranked feed.
 *
 * docs/design-system/pages.md § Home and docs/functional-spec/05-feed.md.
 * This replaces the plain library list that stood here through D14: the
 * response was already a `FeedResponse` of ranked `FeedItem`s carrying a
 * server-written `rankingReason`, and the page was throwing all of it away to
 * render a list of bookmarks.
 *
 * The scope lives in the query string, like the Library's view does, so a
 * filtered feed survives a refresh and can be sent to someone.
 *
 * Everything time-shaped is formatted **here**, on the server, in one clock.
 * The one thing that cannot be — "Updated n min ago", which is a difference
 * between the server's clock and the reader's — is rendered after mount inside
 * `HomeView`, because a text mismatch during hydration does not look like an
 * error: React silently stops attaching handlers and every control on the page
 * dies while the page still screenshots perfectly.
 */
export const dynamic = "force-dynamic";

type SearchParams = { scope?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = parseFeedScope((await searchParams).scope);

  return (
    <main className="mx-auto w-full max-w-screen-lg">
      {/*
        Keyed on the scope so a switch tears the list down rather than
        animating one ranking's items into another's. The fallback holds the
        real geometry: the scope control, three skeleton items, and a rail
        whose labels are already readable.
      */}
      <Suspense key={scope} fallback={<HomeFallback scope={scope} />}>
        <HomeData scope={scope} />
      </Suspense>
    </main>
  );
}

async function HomeData({ scope }: { scope: FeedScope }) {
  // Four independent reads, one round trip's worth of waiting. The rail cannot
  // render without its own data and the column cannot render without the feed,
  // so serialising them would only make the page slower.
  const [feed, counts, rail, continueReading] = await Promise.all([
    BookmarksAPI.feed({ scope }),
    // How the hero is told apart from an empty scope: one is a person who has
    // not started, the other is a filter with nothing behind it.
    BookmarksAPI.counts(),
    FeedAPI.rail(),
    FeedAPI.continueReading(3),
  ]);

  const now = new Date();

  const railProps: HomeRailProps = {
    continueReading: continueReading.map((item) => ({
      bookmarkId: item.bookmark.id,
      href: `/bookmarks/${item.bookmark.id}`,
      title: item.bookmark.title?.trim() || "Untitled",
      percent: Math.round(item.progress.percent),
      timeLeft: timeLeft(
        item.bookmark.metadata?.readingTime,
        item.progress.percent
      ),
    })),
    topics: rail.topics.map((topic) => ({
      topic: topic.topic,
      count: topic.count,
      // Search, not the Library. The Library filters by collection and read
      // status — it has no tag filter to link into, and inventing a query
      // parameter it does not honour would be a link that lies. Search is
      // where a tag is a query today, and D17 is where that surface is rebuilt.
      href: `/search?q=${encodeURIComponent(topic.topic)}`,
    })),
    people: rail.people.map((row) => ({
      id: row.person.id,
      handle: row.person.handle,
      name: row.person.name?.trim() || `@${row.person.handle}`,
      avatarUrl: row.person.pictureUrl,
      href: `/u/${row.person.handle}`,
      savesThisWeek: row.savesThisWeek,
    })),
  };

  // `BookmarksAPI.feed` answers a failure with an empty page rather than
  // throwing, so "nothing came back at all" is the only signal there is that
  // something went wrong. It is a weak one, and it is deliberately only used
  // to decide whether to *offer a retry* — the page renders either way.
  const entries = toFeedEntries(feed.items ?? [], now);
  const noCounts = counts === null;

  return (
    <HomeView
      scope={scope}
      entries={entries}
      nextCursor={feed.nextCursor}
      computedAt={feed.computedAt ?? now}
      newUser={counts !== null && counts.all === 0}
      error={
        noCounts && entries.length === 0
          ? "We couldn't reach your feed."
          : undefined
      }
      rail={railProps}
    />
  );
}

/**
 * "4 min left", from the reading time and how far in they are.
 *
 * Nothing when the pipeline never measured a length: an estimate built on an
 * absent number is a number the reader would believe.
 */
function timeLeft(
  readingMinutes: number | undefined,
  percent: number
): string | undefined {
  if (!readingMinutes || readingMinutes <= 0) return undefined;
  const remaining = Math.ceil(
    readingMinutes * (1 - Math.min(100, Math.max(0, percent)) / 100)
  );
  if (remaining <= 0) return "almost done";
  return `${remaining} min left`;
}
