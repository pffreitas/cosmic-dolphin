import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    How far into a bookmark the reader has got.

    Separate from `Bookmark.readAt`, which stays the only record of *read*.
    Progress is evidence; read state is a decision. The reader may suggest
    marking read at 90%, and never sets it silently.
    """)
model ReadingProgress {
    bookmarkId: string;

    @doc("0-100. Monotonic server-side: a lower value is refused, not stored.")
    @minValue(0)
    @maxValue(100)
    percent: int32;

    @doc("Pixels from the top of the reader. Advisory - a re-extraction changes the document's height and the client falls back to `percent`.")
    scrollOffset?: int32;

    updatedAt: utcDateTime;
}

model SaveReadingProgressRequest {
    @doc("0-100. Values a little outside the range are clamped rather than refused - the client derives this from a layout that is still settling.")
    percent: int32;

    scrollOffset?: int32 | null;
}

model SaveReadingProgressResponse {
    @doc("What is stored now, which is not necessarily what was sent.")
    progress: ReadingProgress;

    @doc("""
        False when the submitted percent was below the stored one and the
        stored value was kept.

        Not an error, and not a 409: a reader scrolling back up has not
        un-read anything. The client stops resending the stale value.
        """)
    accepted: boolean;
}

@doc("A bookmark the reader is part-way through, for Home's Continue reading rail.")
model ContinueReadingItem {
    bookmark: Bookmark;
    progress: ReadingProgress;
}

model ContinueReadingResponse {
    items: ContinueReadingItem[];
}

@doc("""
    A span of extracted content the reader kept.

    Anchored by `quote` plus a short `prefix` and `suffix`, never by character
    offsets: the pipeline re-extracts a page on every reprocess and offsets
    would then point silently at the wrong sentence. Resolution against the
    current extraction happens on the client, in shared code, so a highlight
    that can no longer be placed is reported as orphaned rather than drawn in
    the wrong place.

    Private to its author even when the bookmark is public.
    """)
model Highlight {
    id: string;
    bookmarkId: string;
    userId: string;

    @doc("The selected text, whitespace-normalised. At most 2000 characters.")
    quote: string;

    @doc("~32 characters immediately before the quote. Disambiguates a quote that occurs twice, and re-finds one whose own words changed.")
    prefix?: string;

    @doc("~32 characters immediately after the quote.")
    suffix?: string;

    @doc("The reader's own note. The only mutable field on a highlight.")
    note?: string;

    createdAt: utcDateTime;
}

model CreateHighlightRequest {
    quote: string;
    prefix?: string;
    suffix?: string;
    note?: string;
}

@doc("Only the note is editable. The anchor is what the reader selected and is not rewritten after the fact.")
model UpdateHighlightRequest {
    @doc("`null` clears the note.")
    note: string | null;
}

model GetHighlightsResponse {
    highlights: Highlight[];
}

model DeleteHighlightResponse {
    message: string;
}

@route("/bookmarks")
@tag("Reading")
interface Reading {
    @doc("""
        Record how far into a bookmark the reader has got.

        High frequency, and built for it: the client throttles to one write
        per bookmark per 5 seconds plus one on unmount, and the handler is a
        single guarded upsert.

        Percent is **monotonic server-side**. A value below the stored one is
        refused in SQL - `WHERE excluded.percent >= stored.percent` - so a
        stale request that overtakes a fresh one, or a second tab scrolled
        back to the top, cannot walk progress backwards. The response is 200
        either way, carrying what is actually stored and `accepted: false`
        when the submitted value lost.
        """)
    @useAuth(BearerAuth)
    @put
    @route("/{id}/progress")
    saveProgress(
        @path id: string,
        @body request: SaveReadingProgressRequest,
    ): SaveReadingProgressResponse | {
        @doc("`percent` is missing or not a number.")
        @statusCode
        statusCode: 400;

        @body body: BookmarkError;
    } | {
        @doc("No such bookmark, or not the caller's.")
        @statusCode
        statusCode: 404;

        @body body: BookmarkError;
    } | {
        @doc("Progress write rate limit exceeded. Carries `Retry-After`, in seconds.")
        @statusCode
        statusCode: 429;

        @header("Retry-After") retryAfter?: int32;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("""
        The caller's in-flight reads, newest activity first, for Home's
        Continue reading rail.

        In flight means 5-95%: below that a bookmark was opened rather than
        started, above it the product offers to mark it read. A bookmark the
        user has explicitly marked read or archived leaves the rail whatever
        its scroll position says - the rail is for things they mean to come
        back to.
        """)
    @useAuth(BearerAuth)
    @get
    @route("/continue-reading")
    continueReading(@query limit?: int32 = 12): ContinueReadingResponse | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("The caller's own highlights on a bookmark. Never anyone else's, on a public bookmark or otherwise.")
    @useAuth(BearerAuth)
    @get
    @route("/{id}/highlights")
    listHighlights(@path id: string): GetHighlightsResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Keep a span of a bookmark's extracted content. Only on the caller's own save - a highlight is a note about oneself and needs somewhere private to live.")
    @useAuth(BearerAuth)
    @post
    @route("/{id}/highlights")
    createHighlight(@path id: string, @body request: CreateHighlightRequest):
        | {
              @statusCode statusCode: 201;
              @body body: Highlight;
          }
        | {
              @doc("Empty quote, or a quote or note over its length cap.")
              @statusCode
              statusCode: 400;

              @body body: BookmarkError;
          }
        | {
              @doc("No such bookmark, or not the caller's.")
              @statusCode
              statusCode: 404;

              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 500;
              @body body: BookmarkError;
          };
}

@route("/highlights")
@tag("Reading")
interface Highlights {
    @doc("Edit a highlight's note. The anchor itself is never rewritten.")
    @useAuth(BearerAuth)
    @patch
    update(@path id: string, @body request: UpdateHighlightRequest): Highlight | {
        @doc("The note is over its length cap.")
        @statusCode
        statusCode: 400;

        @body body: BookmarkError;
    } | {
        @doc("No such highlight, or not the caller's. 404 rather than 403 - the existence of another reader's highlight is not the caller's business.")
        @statusCode
        statusCode: 404;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Remove a highlight.")
    @useAuth(BearerAuth)
    @delete
    remove(@path id: string): DeleteHighlightResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };
}
