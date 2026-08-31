import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    How a result earned its place in the list.

    `keyword` — the query's words are literally in the save. `semantic` — the
    save was reached only through vector similarity, so nothing the reader
    typed appears in it. The distinction is carried to the client because a
    row with no visible match has to explain itself: `/search` renders a
    `Related` tag on the semantic ones (docs/design-system/pages.md § Search).
    """)
enum SearchMatchKind {
    keyword,
    semantic,
}

@doc("Read-state filter for search. Mirrors `BookmarkReadStatus`.")
enum SearchReadStatus {
    all,
    unread,
    read,
}

@doc("""
    How far back a search looks, by the save's own `createdAt`.

    A coarse range rather than a pair of dates: the question a reader actually
    asks of their own library is "recently" or "ever", and two date pickers
    buy precision nobody uses at the price of a form.
    """)
enum SearchDateRange {
    any,
    week,
    month,
    year,
}

model HybridSearchResultItem {
    bookmark: Bookmark;
    score: float64;
    matchedChunks: string[];

    @doc("Whether this row was matched literally or only by similarity.")
    match: SearchMatchKind;
}

model HybridSearchResponse {
    results: HybridSearchResultItem[];
}

model SearchAskRequest {
    @doc("The search query / question")
    query: string;
}

@doc("""
    One bookmark an answer was built from.

    Rule 8: no AI output ships without naming its sources, and a source that is
    not a link is not provenance — `bookmarkId` is what makes each one
    clickable. An answer with an empty `sources` array is not an answer and the
    server does not stream one.
    """)
model SearchAnswerSource {
    bookmarkId: string;
    title: string;

    @doc("Bare host — `every.to`, not `https://every.to/`.")
    domain: string;

    faviconUrl?: string;
}

@doc("""
    One frame of the `/search/ask` stream.

    The stream is SSE and the `event:` name carries the discriminator:

      `sources` — always first, and always before any `chunk`. Empty means the
                  query matched nothing, and no `chunk` follows it.
      `chunk`   — a fragment of the answer, in order.
      `done`    — the stream is complete.
      `error`   — the run failed; nothing more follows.

    Modelled rather than left as an opaque `string` so `SearchAnswerSource`
    reaches the generated client, which is where the "an answer names its
    sources" rule has to be typed for a client to be able to honour it.
    """)
model SearchAskEvent {
    @doc("`sources` | `chunk` | `done` | `error`")
    event: string;

    @doc("Present on `sources`. Empty means nothing was found and no answer follows.")
    sources?: SearchAnswerSource[];

    @doc("Present on `chunk`.")
    text?: string;

    @doc("Present on `error`.")
    error?: string;
}

model SearchError {
    error: string;
}

@route("/search")
@tag("Search")
interface Search {
    @doc("Hybrid search combining full-text and vector similarity")
    @useAuth(BearerAuth)
    @get
    hybridSearch(
        @doc("Search query string")
        @query
        q: string,

        @doc("Maximum number of results to return")
        @query
        limit?: int32 = 20,

        @doc("Only saves filed directly in this collection.")
        @query
        collectionId?: string,

        @doc("Only saves carrying this tag, matched case-insensitively.")
        @query
        tag?: string,

        @doc("Read-state filter. Defaults to `all`.")
        @query
        readStatus?: SearchReadStatus = SearchReadStatus.all,

        @doc("How far back to look, by save date. Defaults to `any`.")
        @query
        dateRange?: SearchDateRange = SearchDateRange.any,
    ): HybridSearchResponse | {
        @statusCode statusCode: 400;
        @body body: SearchError;
    } | {
        @statusCode statusCode: 500;
        @body body: SearchError;
    };

    @doc("""
        Search with an AI-generated RAG answer, streamed as SSE.

        The `sources` event is always emitted first. When it is empty the run
        stops there: an answer that cites nothing is not an answer, and the
        server refuses to produce one rather than leaving the client to decide
        whether to show it.
        """)
    @useAuth(BearerAuth)
    @post
    @route("/ask")
    ask(@body request: SearchAskRequest): {
        @statusCode statusCode: 200;
        @header contentType: "text/event-stream";
        @body body: SearchAskEvent;
    } | {
        @statusCode statusCode: 400;
        @body body: SearchError;
    } | {
        @statusCode statusCode: 500;
        @body body: SearchError;
    };
}
