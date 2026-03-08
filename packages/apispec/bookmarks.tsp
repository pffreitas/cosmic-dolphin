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

model Bookmark {
    id: string;
    sourceUrl: string;
    collectionId?: string;
    collectionPath?: CollectionPathItem[];
    title?: string;
    isArchived?: boolean;
    isFavorite?: boolean;
    cosmicImages?: BookmarkImage[];
    cosmicLinks?: BookmarkLink[];
    cosmicSummary?: string;
    cosmicBriefSummary?: string;
    cosmicTags?: string[];
    metadata?: BookmarkMetadata;
    userId: string;
    isPrivateLink?: boolean;
    likeCount?: int32;
    isLikedByCurrentUser?: boolean;
    isPublic?: boolean;
    shareSlug?: string;
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
    suggestedTags?: string[];
    suggestedDescription?: string;
}

model GetCollectionsResponse {
    collections: Collection[];
}

model BookmarkError {
    error: string;
}

@route("/bookmarks")
@tag("Bookmarks")
interface Bookmarks {
    @doc("Create a new bookmark")
    @useAuth(BearerAuth)
    @post
    create(@body request: CreateBookmarkRequest):
        | {
              @statusCode statusCode: 201;
              @body body: CreateBookmarkResponse;
          }
        | {
              @statusCode statusCode: 400;
              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 408;
              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 409;
              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 422;
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
