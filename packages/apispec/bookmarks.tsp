import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("Processing state of AI pipeline for a bookmark")
enum ProcessingStatus {
    idle,
    processing,
    completed,
    failed,
}

@doc("Read-state filter for bookmark library queries")
enum BookmarkReadStatus {
    all,
    unread,
    read,
}

@doc("""
    Library ordering - docs/functional-spec/04-library.md § Ordering.

    `newest` is chronological by `created_at` descending. It is the default and
    must always be one click away: AI organisation is an overlay on that order,
    never a replacement for it.
    """)
enum BookmarkSort {
    newest,
    oldest,
    recently_read,
    longest_unread,
}

@doc("""
    Which slice of the library a query is about - the Library rail's rows,
    docs/functional-spec/04-library.md § Collections.

    `all` is every non-archived save. `inbox` narrows that to the ones nothing
    has filed yet (`collection_id IS NULL`). `archive` is the only scope that
    returns `is_archived = true` rows, which is what makes archiving a way out
    of the list rather than a delete.
    """)
enum BookmarkScope {
    all,
    inbox,
    archive,
}

@doc("Durable processing timeline status for runs, phases, and turns")
enum BookmarkProcessingTimelineStatus {
    running,
    completed,
    failed,
}

@doc("Processing timeline span kind")
enum BookmarkProcessingEventKind {
    run,
    phase,
    turn,
}

@doc("The pipeline's phases, in order - docs/functional-spec/03-ai-pipeline.md. Sequential, each independently retryable. `fetch` through `file` are surfaced in the UI as a five-line checklist; `embed` runs silently because it has no user-legible output.")
enum BookmarkProcessingPhase {
    fetch,
    extract,
    summarise,
    tag,
    file,
    embed,
}

model Bookmark {
    id: string;
    sourceUrl: string;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
    collectionId?: string;
    collectionPath?: CollectionPathItem[];
    title?: string;
    isArchived?: boolean;
    isFavorite?: boolean;
    cosmicImages?: BookmarkImage[];
    cosmicLinks?: BookmarkLink[];
    cosmicSummary?: string;
    cosmicBriefSummary?: string;

    @doc("The full brief's key points - 2-5 findings of at most 140 characters, parsed out of `cosmicSummary` once by the pipeline. Rendered with a dot marker, never numbered.")
    cosmicKeyPoints?: string[];

    cosmicTags?: string[];
    metadata?: BookmarkMetadata;
    userId: string;
    isPrivateLink?: boolean;
    likeCount?: int32;
    isLikedByCurrentUser?: boolean;
    isPublic?: boolean;
    shareSlug?: string;
    readAt?: utcDateTime;
    isRead?: boolean;
    processingStatus?: ProcessingStatus;
    processingStartedAt?: utcDateTime;
    processingCompletedAt?: utcDateTime;
    processingError?: string;
}

model BookmarkImage {
    url: string;
    title: string;
    description: string;
}

model BookmarkLink {
    url: string;
    relevance: string;
}

model OpenGraphMetadata {
    favicon?: string;
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    site_name?: string;
    type?: string;
    locale?: string;
    article_author?: string;
    article_published_time?: string;
    article_modified_time?: string;
    article_section?: string;
    article_tag?: string[];
}

model BookmarkMetadata {
    openGraph?: OpenGraphMetadata;
    wordCount?: int32;
    readingTime?: int32;

    @doc("The URL exactly as the user pasted it, before normalisation. `sourceUrl` holds the normalised form.")
    originalUrl?: string;
}

model CreateBookmarkRequest {
    @doc("The source URL to bookmark")
    source_url: string;

    @doc("Optional collection ID to add the bookmark to")
    collection_id?: string;

    @doc("Optional title for the bookmark")
    title?: string;

    @doc("Optional description for the bookmark")
    description?: string;

    @doc("Optional tags for the bookmark")
    tags?: string[];

    @doc("Whether this is a private link that cannot be scraped")
    is_private_link?: boolean;
}

model CreateBookmarkResponse {
    bookmark: Bookmark;
    message: string;

    @doc("The user already had this URL. The bookmark returned is the existing one — nothing was created and nothing was re-queued. A duplicate paste is not an error.")
    alreadySaved?: boolean;
}

model GetBookmarksQuery {
    @doc("Filter bookmarks by collection ID")
    @query
    collection_id?: string;

    @doc("Maximum number of bookmarks to return")
    @query
    limit?: int32 = 50;

    @doc("Number of bookmarks to skip")
    @query
    offset?: int32 = 0;

    @doc("Filter bookmarks by read state")
    @query
    read_status?: BookmarkReadStatus = BookmarkReadStatus.all;

    @doc("Which rail row this is. Ignored when `collection_id` names a collection.")
    @query
    scope?: BookmarkScope = BookmarkScope.all;

    @doc("Ordering. Chronological `newest` is the default.")
    @query
    sort?: BookmarkSort = BookmarkSort.newest;

    @doc("""
        Opaque keyset cursor taken verbatim from the previous page's
        `nextCursor`. Present, it wins over `offset` - a library is written to
        while it is being paged, and an offset silently duplicates and skips.
        A cursor produced under a different `sort` is rejected with 400.
        """)
    @query
    cursor?: string;
}

model GetBookmarksResponse {
    bookmarks: Bookmark[];

    @doc("Cursor for the next page. Absent when this page is the last one.")
    nextCursor?: string;
}

@doc("Non-archived bookmarks filed in one collection.")
model BookmarkCollectionCount {
    collectionId: string;
    count: int32;
}

@doc("""
    The counts the Library rail renders beside its rows. One query rather than
    one request per node - the rail has as many rows as the user has
    collections, and a count per row would be a request per row.
    """)
model BookmarkLibraryCounts {
    @doc("Every non-archived bookmark - the `All saves` row.")
    all: int32;

    @doc("Non-archived with `collection_id IS NULL` - the `Inbox` row.")
    inbox: int32;

    @doc("Non-archived with `read_at IS NULL` - the `Read later` row.")
    unread: int32;

    @doc("`is_archived = true` - the `Archive` row.")
    archived: int32;

    @doc("Per-collection counts. A collection holding nothing is absent, not zero.")
    collections: BookmarkCollectionCount[];
}

@doc("""
    Partial update of a bookmark. Every field is optional and an absent field is
    left alone.

    Where the bookmark is filed is deliberately not here: moving a bookmark is
    `PATCH /bookmarks/{id}/collection`, which writes `filing_source` in the same
    statement as the move.
    """)
model UpdateBookmarkRequest {
    title?: string;

    @doc("Archive or restore. Archiving keeps the bookmark searchable and is reversible; it is never a delete.")
    isArchived?: boolean;

    @doc("The complete tag list after the edit, not a delta - so an undo can restore exactly what was there.")
    tags?: string[];
}

model SearchBookmarksQuery {
    @doc("Search query string")
    @query
    query: string;

    @doc("Maximum number of bookmarks to return")
    @query
    limit?: int32 = 50;

    @doc("Number of bookmarks to skip")
    @query
    offset?: int32 = 0;
}

model SearchBookmarksResponse {
    bookmarks: Bookmark[];
    total?: int32;
}

model LikeResponse {
    likeCount: int32;
    isLikedByCurrentUser: boolean;
}

model ShareBookmarkResponse {
    isPublic: boolean;
    shareUrl: string;
}

model BookmarkProcessingRun {
    id: string;
    bookmarkId: string;
    userId: string;
    status: BookmarkProcessingTimelineStatus;
    startedAt: utcDateTime;
    endedAt?: utcDateTime;
    durationMs?: int64;
    inputTokens: int32;
    outputTokens: int32;
    totalTokens: int32;
    reasoningTokens: int32;
    cachedInputTokens: int32;
    costUsd?: string;
    error?: string;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
}

model BookmarkProcessingEvent {
    id: string;
    runId: string;
    parentEventId?: string;
    kind: BookmarkProcessingEventKind;

    @doc("One of `BookmarkProcessingPhase` for a phase or turn span. Absent on the run span and on bookkeeping that was never a user-facing phase.")
    phase?: string;

    name: string;
    status: BookmarkProcessingTimelineStatus;
    sequence: int32;
    startedAt: utcDateTime;
    endedAt?: utcDateTime;
    durationMs?: int64;
    modelId?: string;
    inputTokens: int32;
    outputTokens: int32;
    totalTokens: int32;
    reasoningTokens: int32;
    cachedInputTokens: int32;
    costUsd?: string;
    providerMetadata?: Record<unknown>;
    metadata?: Record<unknown>;
    error?: string;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
}

model BookmarkProcessingTimelineResponse {
    bookmark: Bookmark;
    run?: BookmarkProcessingRun;
    events: BookmarkProcessingEvent[];
    pollAfterMs: int32;
}

model ReprocessBookmarkRequest {
    @doc("Run only this phase. Absent reprocesses the whole pipeline.")
    phase?: BookmarkProcessingPhase;
}

model ReprocessBookmarkResponse {
    bookmark: Bookmark;
    message: string;
}

model PreviewMetadata {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
    url: string;
}

model PreviewRequest {
    @doc("The URL to preview")
    url: string;
}

model PreviewResponse {
    metadata: PreviewMetadata;
    scrapable: boolean;
}

model DeleteBookmarkResponse {
    message: string;
}

model BookmarkError {
    error: string;
}

@route("/bookmarks")
@tag("Bookmarks")
interface Bookmarks {
    @doc("""
        Create a new bookmark.

        The URL is normalised before anything else (lowercased scheme and host,
        trailing slash stripped, `utm_*`/`fbclid`/`gclid`/`ref`/`mc_cid`
        dropped); the normalised form is stored in `sourceUrl` and the paste is
        preserved in `metadata.originalUrl`.

        If the caller already has that normalised URL, this returns 200 with
        `alreadySaved: true` and the existing bookmark — a duplicate paste is
        not an error and never a 409.

        The handler writes the row and enqueues; fetching, extraction,
        summarising, tagging and filing all happen in the worker. Nothing is
        awaited that touches the network or a model.
        """)
    @useAuth(BearerAuth)
    @post
    create(@body request: CreateBookmarkRequest):
        | {
              @statusCode statusCode: 201;
              @body body: CreateBookmarkResponse;
          }
        | {
              @doc("Already in the caller's library. `alreadySaved` is true.")
              @statusCode
              statusCode: 200;

              @body body: CreateBookmarkResponse;
          }
        | {
              @doc("Malformed URL, or a private link with no description.")
              @statusCode
              statusCode: 400;

              @body body: BookmarkError;
          }
        | {
              @doc("Save rate limit exceeded. Carries `Retry-After`, in seconds.")
              @statusCode
              statusCode: 429;

              @header("Retry-After") retryAfter?: int32;

              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 500;
              @body body: BookmarkError;
          };

    @doc("""
        Get the caller's bookmarks.

        Ordered by `sort`, which defaults to `newest` - chronological, the order
        the Library falls back to and the one every other ordering is an overlay
        on.

        Paging is keyset: read `nextCursor` off the response and hand it back as
        `cursor`. `offset` remains for callers that have not moved over, but it
        is not safe on a list being written to while it is paged.
        """)
    @useAuth(BearerAuth)
    @get
    list(...GetBookmarksQuery): GetBookmarksResponse | {
        @doc("Unknown `sort`, `scope` or `read_status`, or a cursor that does not belong to this `sort`.")
        @statusCode
        statusCode: 400;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("The counts beside every row of the Library rail, in one query.")
    @useAuth(BearerAuth)
    @get
    @route("/counts")
    counts(): BookmarkLibraryCounts | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Get user's unread bookmark feed")
    @useAuth(BearerAuth)
    @get
    @route("/feed")
    feed(
        @query limit?: int32 = 50,
        @query offset?: int32 = 0,
    ): GetBookmarksResponse | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Get a bookmark by ID")
    @useAuth(BearerAuth)
    @get
    findById(@path id: string): Bookmark | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Get the durable processing timeline for a bookmark")
    @useAuth(BearerAuth)
    @get
    @route("/{id}/processing-timeline")
    getProcessingTimeline(@path id: string): BookmarkProcessingTimelineResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Start a fresh processing run for a bookmark, optionally scoped to one phase. Appends to the existing timeline rather than replacing it, so the run the user already watched stays on screen. Also the **Summarise now** action on a bookmark left `idle` by the daily processing budget: an explicit request is never refused for budget.")
    @useAuth(BearerAuth)
    @post
    @route("/{id}/reprocess")
    reprocess(@path id: string, @body request: ReprocessBookmarkRequest):
        | {
              @statusCode statusCode: 202;
              @body body: ReprocessBookmarkResponse;
          }
        | {
              @doc("Unknown phase.")
              @statusCode
              statusCode: 400;

              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 404;
              @body body: BookmarkError;
          }
        | {
              @doc("Reprocess rate limit exceeded. Carries `Retry-After`, in seconds.")
              @statusCode
              statusCode: 429;

              @header("Retry-After") retryAfter?: int32;

              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 500;
              @body body: BookmarkError;
          };

    @doc("""
        Update a bookmark's title, tags, or archived flag.

        This is what the Library's bulk bar writes through for **Archive** and
        **Add tag**. It takes the whole tag list rather than a delta so the
        8-second undo can put back exactly what was there.
        """)
    @useAuth(BearerAuth)
    @patch
    update(@path id: string, @body request: UpdateBookmarkRequest): Bookmark | {
        @doc("Malformed body - a blank tag, or nothing to change.")
        @statusCode
        statusCode: 400;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Delete a bookmark and all associated data")
    @useAuth(BearerAuth)
    @delete
    remove(@path id: string): DeleteBookmarkResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
          };

    @doc("Mark a bookmark as read")
    @useAuth(BearerAuth)
    @put
    @route("/{id}/read")
    markRead(@path id: string): Bookmark | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Mark a bookmark as unread")
    @useAuth(BearerAuth)
    @delete
    @route("/{id}/read")
    markUnread(@path id: string): Bookmark | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("""
        Move a bookmark into a collection, or to Inbox with `collectionId: null`.

        This is the override endpoint. It sets `filing_source = 'user'` in the
        same statement as the move, so the pipeline's `file` phase will never
        touch this bookmark again. A refile the pipeline can undo on its next
        run is worse than no refile at all.
        """)
    @useAuth(BearerAuth)
    @patch
    @route("/{id}/collection")
    refile(@path id: string, @body request: RefileBookmarkRequest): Bookmark | {
        @doc("The named collection is not the caller's.")
        @statusCode
        statusCode: 404;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Search bookmarks")
    @useAuth(BearerAuth)
    @get
    @route("/search")
    search(...SearchBookmarksQuery): SearchBookmarksResponse | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Like a bookmark")
    @useAuth(BearerAuth)
    @put
    @route("/{id}/like")
    like(@path id: string): LikeResponse | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Unlike a bookmark")
    @useAuth(BearerAuth)
    @delete
    @route("/{id}/like")
    unlike(@path id: string): LikeResponse | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Share a bookmark (make it public)")
    @useAuth(BearerAuth)
    @put
    @route("/{id}/share")
    share(@path id: string): ShareBookmarkResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Unshare a bookmark (make it private)")
    @useAuth(BearerAuth)
    @delete
    @route("/{id}/share")
    unshare(@path id: string): ShareBookmarkResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Preview a URL and get metadata without saving")
    @useAuth(BearerAuth)
    @post
    @route("/preview")
    preview(@body request: PreviewRequest): PreviewResponse | {
        @statusCode statusCode: 400;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };
}

@route("/bookmarks/shared")
@tag("SharedBookmarks")
interface SharedBookmarks {
    @doc("Get a publicly shared bookmark by its share slug")
    @get
    findBySlug(@path slug: string): Bookmark | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };
}
