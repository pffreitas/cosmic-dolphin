import { Suspense } from "react";

import { ExploreAPI } from "@/lib/api/explore";
import { ExploreFallback, ExploreView } from "@/components/explore/explore-view";
import {
  ALL_TOPICS,
  parseTopic,
  toTopicOptions,
} from "@/components/explore/explore-data";
import { toFeedEntries } from "@/components/feed/feed-data";
import type { ExploreRailProps } from "@/components/explore/explore-rail";

/**
 * Explore — `/explore`, docs/design-system/pages.md § Explore.
 *
 * What stood here until D18: a `bg-gray-50` card containing the sentence
 * "Discover new content and features coming soon…". This is the real surface.
 *
 * The topic lives in the query string so a filtered Explore survives a refresh
 * and can be sent to somebody, exactly as Home's scope does. Everything
 * time-shaped is formatted **here**, on the server, in one clock — a "2d ago"
 * computed in the first client render against a "yesterday" in the server one
 * is a hydration mismatch, and a hydration mismatch does not look like an
 * error: React silently stops attaching handlers and every control on the page
 * dies while the page still screenshots perfectly.
 */
export const dynamic = "force-dynamic";

type SearchParams = { topic?: string };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const topic = parseTopic((await searchParams).topic);

  return (
    <main className="mx-auto w-full max-w-screen-lg">
      {/*
        Keyed on the topic so a switch tears the list down rather than
        animating one topic's items into another's.
      */}
      <Suspense key={topic} fallback={<ExploreFallback />}>
        <ExploreData topic={topic} />
      </Suspense>
    </main>
  );
}

async function ExploreData({ topic }: { topic: string }) {
  const [page, rail] = await Promise.all([
    ExploreAPI.list({ topic: topic === ALL_TOPICS ? undefined : topic }),
    ExploreAPI.rail(),
  ]);

  const now = new Date();

  const railProps: ExploreRailProps = {
    collections: rail.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      saveCount: collection.saveCount,
      ownerHandle: collection.owner.handle,
      ownerName: collection.owner.name?.trim() || `@${collection.owner.handle}`,
      // Collections have no public route of their own yet, so the row leads to
      // the owner's profile, whose Collections tab is where it lives. A link
      // to a route that does not exist would be worse than a link one hop out.
      href: `/u/${collection.owner.handle}`,
    })),
    people: rail.people.map((row) => ({
      id: row.person.id,
      handle: row.person.handle,
      name: row.person.name?.trim() || `@${row.person.handle}`,
      avatarUrl: row.person.pictureUrl,
      href: `/u/${row.person.handle}`,
      savesThisWeek: row.savesThisWeek,
      followers: row.followers,
      followed: row.isFollowedByViewer,
    })),
  };

  // `null` is a failed request; an empty `items` array is a young graph. The
  // empty state must only fire for the second, or it lies about the product.
  if (page === null) {
    return (
      <ExploreView
        topic={topic}
        topics={[]}
        entries={[]}
        rail={railProps}
        error="We couldn't reach Explore."
      />
    );
  }

  return (
    <ExploreView
      topic={topic}
      topics={toTopicOptions(page.topics ?? [])}
      entries={toFeedEntries(page.items ?? [], now)}
      nextCursor={page.nextCursor}
      rail={railProps}
    />
  );
}
