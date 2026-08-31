import { CollectionsAPI } from "@/lib/api/bookmarks";
import { SearchView } from "@/components/search/search-view";
import { parseSearchView } from "@/components/search/search-data";

/**
 * Search — `/search`.
 *
 * The route half of D17. The other half is the `⌘K` palette, and the two share
 * a row, a provenance line and an answer component so that "one vocabulary
 * across the search route and ⌘K" is a fact about the code rather than a
 * promise about it.
 *
 * The query and every filter live in the URL, so a search is a link.
 */
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  collection_id?: string;
  tag?: string;
  read_status?: string;
  date?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = parseSearchView(params);

  // The collection filter's options. Read on the server so the filter row is
  // complete in the first paint rather than popping in a beat later.
  const collections = await CollectionsAPI.list();

  return (
    <main className="mx-auto w-full max-w-screen-lg px-4 sm:px-6">
      <SearchView view={view} collections={collections} />
    </main>
  );
}
