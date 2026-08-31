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

@doc("Where a collection suggestion stands. `pending` is still the user's to answer; `accepted` became a real collection; `dismissed` is remembered until `dismissedUntil`.")
enum CollectionSuggestionStatus {
    pending,
    accepted,
    dismissed,
}

@doc("""
    A collection the pipeline thinks should exist. It does not exist yet.

    The `file` phase never creates a collection - it accumulates supporting
    bookmarks against a proposed name. Only `POST /collections/suggestions/{id}/accept`
    turns one into a collection.
    """)
model CollectionSuggestion {
    id: string;
    userId: string;
    name: string;
    parentId?: string;
    bookmarkIds: string[];
    status: CollectionSuggestionStatus;

    @doc("Set when the proposal was dismissed. It is not re-offered before this instant - 30 days out.")
    dismissedUntil?: utcDateTime;

    createdAt: utcDateTime;
}

model GetCollectionsResponse {
    collections: Collection[];
}

model GetCollectionSuggestionsResponse {
    suggestions: CollectionSuggestion[];
}

model CreateCollectionRequest {
    @doc("Display name. Required, trimmed, at most 120 characters.")
    name: string;

    description?: string;

    @doc("A design-system collection colour token name, never a hex value.")
    color?: string;

    icon?: string;

    @doc("Parent collection. Must be a root collection - the tree is capped at two levels.")
    parentId?: string | null;

    isPublic?: boolean;
}

@doc("""
    Rename, recolour, or reparent. Every field is optional; an absent field is
    left alone. `parentId: null` moves the collection back to the root.
    """)
model UpdateCollectionRequest {
    name?: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    parentId?: string | null;
    isPublic?: boolean;
}

model DeleteCollectionResponse {
    message: string;
}

model AcceptCollectionSuggestionResponse {
    @doc("The collection that now exists.")
    collection: Collection;

    suggestion: CollectionSuggestion;

    @doc("How many supporting bookmarks were actually filed. Lower than the supporter count when the user had already filed one of them by hand - accepting a proposal never overrides a human decision.")
    filedCount: int32;
}

model CollectionSuggestionResponse {
    suggestion: CollectionSuggestion;
}

model RefileBookmarkRequest {
    @doc("The collection to move the bookmark into. `null` moves it to Inbox.")
    collectionId: string | null;
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

    @doc("""
        Create a collection.

        The tree is capped at two levels: `parentId` must name a root
        collection the caller owns. A deeper parent is rejected with 422.
        """)
    @useAuth(BearerAuth)
    @post
    create(@body request: CreateCollectionRequest):
        | {
              @statusCode statusCode: 201;
              @body body: Collection;
          }
        | {
              @doc("Missing or malformed name.")
              @statusCode
              statusCode: 400;

              @body body: BookmarkError;
          }
        | {
              @doc("The named parent does not exist, or is not the caller's.")
              @statusCode
              statusCode: 404;

              @body body: BookmarkError;
          }
        | {
              @doc("The parent is already nested. Collections are limited to two levels.")
              @statusCode
              statusCode: 422;

              @body body: BookmarkError;
          }
        | {
              @statusCode statusCode: 500;
              @body body: BookmarkError;
          };

    @doc("""
        Rename, recolour, or reparent a collection.

        Reparenting is checked against the same two-level cap as creation, from
        both ends: the new parent must be a root collection, and a collection
        that has children of its own cannot be moved under anything.
        """)
    @useAuth(BearerAuth)
    @patch
    update(@path id: string, @body request: UpdateCollectionRequest): Collection | {
        @doc("Malformed name, or a collection named as its own parent.")
        @statusCode
        statusCode: 400;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @doc("The move would create a third level.")
        @statusCode
        statusCode: 422;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("""
        Delete a collection. Its bookmarks move to Inbox - they are never
        deleted. Child collections are removed with it, and their bookmarks
        move to Inbox too.
        """)
    @useAuth(BearerAuth)
    @delete
    remove(@path id: string): DeleteCollectionResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("The AI collection proposals worth answering: pending, and supported by enough bookmarks to be worth the interruption.")
    @useAuth(BearerAuth)
    @get
    @route("/suggestions")
    listSuggestions(): GetCollectionSuggestionsResponse | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Accept a proposal: create the collection and file its supporting bookmarks into it. The only path by which a proposal becomes a collection.")
    @useAuth(BearerAuth)
    @post
    @route("/suggestions/{id}/accept")
    acceptSuggestion(@path id: string): AcceptCollectionSuggestionResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @doc("The proposal was already accepted or dismissed.")
        @statusCode
        statusCode: 409;

        @body body: BookmarkError;
    } | {
        @doc("The proposal's parent has since moved, so creating it would make a third level.")
        @statusCode
        statusCode: 422;

        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };

    @doc("Decline a proposal. Remembered for 30 days, not forever.")
    @useAuth(BearerAuth)
    @post
    @route("/suggestions/{id}/dismiss")
    dismissSuggestion(@path id: string): CollectionSuggestionResponse | {
        @statusCode statusCode: 404;
        @body body: BookmarkError;
    } | {
        @statusCode statusCode: 500;
        @body body: BookmarkError;
    };
}
