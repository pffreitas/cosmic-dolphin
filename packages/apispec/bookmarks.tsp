import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

model Collection {
    id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parentId?: string;
    userId: string;
    isPublic?: boolean;
}

@doc("Path item for breadcrumb navigation in collection hierarchy")
model CollectionPathItem {
    id: string;
    name: string;
}

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
}

model GetBookmarksResponse {
    bookmarks: Bookmark[];
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

model GetCollectionsResponse {
    collections: Collection[];
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

    @doc("Get user's bookmarks")
    @useAuth(BearerAuth)
    @get
    list(...GetBookmarksQuery): GetBookmarksResponse | {
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

@route("/collections")
@tag("Collections")
interface Collections {
    @doc("Get user's collections")
    @useAuth(BearerAuth)
    @get
    list(): GetCollectionsResponse | {
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
