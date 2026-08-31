import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    A topic the product as a whole has been saving, and how many public saves
    carry it inside the discovery window.

    This is **not** `FeedRailTopic`. That one counts the reader's own saves and
    answers "what have I been reading"; this one counts everyone's public saves
    and answers "what is the product reading". Same shape, different question,
    and collapsing them would make Explore a mirror of Home — which is exactly
    what Explore exists not to be.
    """)
model ExploreTopic {
    topic: string;
    count: int32;
}

@doc("""
    A public collection with public saves in it, and who it belongs to.

    Collections are the one library structure that survives being made public,
    so they are what Explore recommends rather than a second list of links.
    """)
model TrendingCollection {
    id: string;
    name: string;
    description?: string;

    @doc("How many public, non-archived saves are filed in it. Never the private ones.")
    saveCount: int32;

    owner: FeedActor;
}

@doc("""
    Someone worth following, with their public output for the window.

    `isFollowedByViewer` is computed for this list because it is short and
    bounded (the rail renders five) — unlike `/users/{handle}/followers`, where
    a relationship per row would be a query per row.
    """)
model TrendingPerson {
    person: FeedActor;

    @doc("Public saves inside the discovery window.")
    savesThisWeek: int32;

    @doc("Follower count — the only global number Explore reports about a person.")
    followers: int32;

    isFollowedByViewer: boolean;
}

@doc("""
    Explore's rail - docs/design-system/pages.md § Explore.

    Both lists are empty until the social graph is populated, and the client is
    expected to say so honestly rather than pad the column with the reader's
    own material.
    """)
model ExploreRailResponse {
    collections: TrendingCollection[];
    people: TrendingPerson[];
}

@doc("""
    A page of Explore - docs/design-system/pages.md § Explore.

    The same `FeedItem` shape Home uses, ranked for **discovery** rather than
    personal usefulness: engagement on public saves with a recency decay, over
    everybody's public library rather than the reader's own and the people they
    follow. `rankingReason` still comes from the server and is still never
    synthesised on the client.

    `topics` rides along with the page because the segmented control is part of
    the same surface and a second request for six strings would reflow the page
    once for nothing.
    """)
model ExploreResponse {
    items: FeedItem[];

    @doc("The topic segmented control's options, most-saved first. Empty when nothing public carries a tag.")
    topics: ExploreTopic[];

    @doc("Keyset cursor for the next page. Absent when this page is the last one.")
    nextCursor?: string;

    @doc("When this page was computed.")
    computedAt: utcDateTime;
}

model ExploreError {
    error: string;
}

@route("/explore")
@tag("Explore")
interface Explore {
    @doc("""
        Public saves ranked for discovery, plus the topic control's options.

        Excludes the caller's own saves - Explore is where you find what you do
        not already have - and everything either side of a block.
        """)
    @useAuth(BearerAuth)
    @get
    list(
        @doc("Restrict to one `cosmicTags` entry, matched case-insensitively. Absent means every topic.")
        @query
        topic?: string,

        @doc("Page size. 20 is the product default; 50 is the ceiling.")
        @query
        limit?: int32 = 20,

        @doc("Opaque keyset cursor taken verbatim from the previous page's `nextCursor`.")
        @query
        cursor?: string,
    ): ExploreResponse | {
        @doc("A `limit` out of range, or a cursor that does not decode.")
        @statusCode
        statusCode: 400;

        @body body: ExploreError;
    } | {
        @statusCode statusCode: 500;
        @body body: ExploreError;
    };

    @doc("Trending collections and people to follow. One request, because it is one column.")
    @useAuth(BearerAuth)
    @get
    @route("/rail")
    rail(
        @query collectionLimit?: int32 = 4,
        @query peopleLimit?: int32 = 5,
    ): ExploreRailResponse | {
        @statusCode statusCode: 400;
        @body body: ExploreError;
    } | {
        @statusCode statusCode: 500;
        @body body: ExploreError;
    };
}
