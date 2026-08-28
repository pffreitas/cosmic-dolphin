import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    A comment on a bookmark.

    Plain text plus links — no rich text, no images, no embeds, and no field
    here in which to put any. 2,000 characters.

    **One level of nesting.** `parentId` is either absent (a top-level comment)
    or the id of a top-level comment. It is never the id of a reply: a
    `parentId` pointing at a reply is re-pointed server-side at that reply's own
    parent, so the client's request succeeds and lands where a one-level thread
    can hold it. Deep threads are where reading products turn into forums.
    """)
model Comment {
    id: string;
    bookmarkId: string;

    @doc("Absent on a top-level comment. Always a top-level comment's id when present.")
    parentId?: string;

    @doc("""
        Absent on a deleted comment, which carries `isDeleted: true` and renders
        as "Comment deleted".
        """)
    body?: string;

    @doc("""
        Absent on a deleted comment: a tombstone stands in the thread so its
        replies still have a parent, and it credits nobody.
        """)
    author?: CommentAuthor;

    createdAt: utcDateTime;

    @doc("Equal to `createdAt` until edited. Editing is refused more than 15 minutes after `createdAt`.")
    updatedAt: utcDateTime;

    @doc("True when the body was edited after it was written.")
    isEdited: boolean;

    @doc("""
        A soft-deleted comment that still holds replies. It has no body and no
        author, and it cannot be edited, replied to, or reported.
        """)
    isDeleted: boolean;

    @doc("True when the caller wrote this comment.")
    isOwn: boolean;

    @doc("""
        True while this comment is still inside its 15-minute edit window.

        The server is the authority — it re-checks on every `PATCH` — but the
        client needs it to decide whether to offer an Edit control at all,
        rather than offering one that will be refused.
        """)
    canEdit: boolean;
}

@doc("The public identity behind a comment. Never carries an email — see `PublicProfile`.")
model CommentAuthor {
    id: string;

    @doc("Absent only in the degraded case where a handle could not be minted at signup.")
    handle?: string;

    name?: string;
    pictureUrl?: string;
}

@doc("""
    A thread, chronological.

    There is no ranking, no "top comment" and no score, and no field here in
    which to express one. Top-level comments are oldest first, and each one's
    replies are oldest first beneath it — a conversation reads forwards.
    """)
model CommentsResponse {
    comments: Comment[];

    @doc("Live comments on the bookmark, tombstones excluded. Matches `Bookmark.commentCount`.")
    commentCount: int32;
}

model CreateCommentRequest {
    @doc("1-2,000 characters of plain text. Leading and trailing whitespace is trimmed before the length is measured.")
    @minLength(1)
    @maxLength(2000)
    body: string;

    @doc("The comment being replied to. A reply to a reply is re-pointed at that reply's parent rather than refused.")
    parentId?: string;
}

model UpdateCommentRequest {
    @minLength(1)
    @maxLength(2000)
    body: string;
}

@doc("""
    What happened to the comment.

    A delete is one of two different things and the client has to render them
    differently: a comment with replies becomes a tombstone that stays in the
    thread, and a comment without replies stops existing.
    """)
model DeleteCommentResponse {
    @doc("False when the comment was soft-deleted because it has replies; `comment` then carries the tombstone.")
    deleted: boolean;

    @doc("Present only on a soft delete. The tombstone, for the client to swap in place.")
    comment?: Comment;

    @doc("The parent bookmark's comment count after the call.")
    commentCount: int32;
}

model CommentError {
    error: string;
}

@doc("""
    A report of a public bookmark or a comment.

    Exactly one target. Reported content **stays visible** pending review:
    auto-hide is trivially weaponised, so nothing about filing this changes what
    anyone can see.
    """)
model CreateReportRequest {
    @doc("The bookmark being reported. Exactly one of `bookmarkId` and `commentId`.")
    bookmarkId?: string;

    @doc("The comment being reported. Exactly one of `bookmarkId` and `commentId`.")
    commentId?: string;

    @doc("Why. Free text, 1-1,000 characters — a fixed taxonomy would need a moderation product to consume it, and there is not one yet.")
    @minLength(1)
    @maxLength(1000)
    reason: string;
}

@doc("""
    Deliberately thin.

    It says the report was received and nothing else. It does not say what will
    happen, does not echo the target back, and — most importantly — carries no
    signal that the reported content has changed state, because it has not.
    """)
model CreateReportResponse {
    reported: boolean;
}

@route("/bookmarks")
@tag("Comments")
interface BookmarkComments {
    @doc("""
        The thread on a bookmark, chronological.

        Visible when the bookmark is public or the caller owns it — a comment on
        a private bookmark is a private note to self. Un-sharing therefore
        *hides* a thread rather than deleting it: this route starts answering
        404 to everyone but the owner, and re-sharing brings the same comments
        back.
        """)
    @useAuth(BearerAuth)
    @get
    @route("/{id}/comments")
    list(@path id: string): CommentsResponse | {
        @statusCode statusCode: 400;
        @body body: CommentError;
    } | {
        @doc("No such bookmark, or it is not public and not the caller's.")
        @statusCode
        statusCode: 404;

        @body body: CommentError;
    } | {
        @statusCode statusCode: 500;
        @body body: CommentError;
    };

    @doc("""
        Post a comment or a reply. Rate limited to 10 per minute.

        A `parentId` that points at a reply is not an error: the new comment
        attaches to that reply's parent, and the response says where it actually
        landed.
        """)
    @useAuth(BearerAuth)
    @post
    @route("/{id}/comments")
    create(@path id: string, @body request: CreateCommentRequest): {
        @statusCode statusCode: 201;
        @body body: Comment;
    } | {
        @doc("Empty body, over 2,000 characters, or a `parentId` that is not a comment on this bookmark.")
        @statusCode
        statusCode: 400;

        @body body: CommentError;
    } | {
        @statusCode statusCode: 404;
        @body body: CommentError;
    } | {
        @doc("Comment rate limit exceeded. Carries `Retry-After`, in seconds.")
        @statusCode
        statusCode: 429;

        @header("Retry-After") retryAfter?: int32;

        @body body: CommentError;
    } | {
        @statusCode statusCode: 500;
        @body body: CommentError;
    };
}

@route("/comments")
@tag("Comments")
interface Comments {
    @doc("""
        Edit a comment, for 15 minutes after it was written and not a second
        longer.

        The window is a product decision, not a technical one: a comment people
        have already replied to should not be able to become a different comment
        underneath them. 403 once it closes, because the caller is the author —
        it is the comment that is frozen, not the caller who is unauthorised.
        """)
    @useAuth(BearerAuth)
    @patch
    @route("/{id}")
    update(@path id: string, @body request: UpdateCommentRequest): Comment | {
        @statusCode statusCode: 400;
        @body body: CommentError;
    } | {
        @doc("The 15-minute edit window has closed, or the comment is deleted.")
        @statusCode
        statusCode: 403;

        @body body: CommentError;
    } | {
        @doc("No such comment, or it is not the caller's.")
        @statusCode
        statusCode: 404;

        @body body: CommentError;
    } | {
        @statusCode statusCode: 500;
        @body body: CommentError;
    };

    @doc("""
        Delete a comment.

        Soft-deletes when it has replies — the row stays as a tombstone so those
        replies keep a parent — and hard-deletes when it does not. Unlike
        editing, deleting never expires: a person can always withdraw what they
        said.
        """)
    @useAuth(BearerAuth)
    @delete
    @route("/{id}")
    remove(@path id: string): DeleteCommentResponse | {
        @statusCode statusCode: 400;
        @body body: CommentError;
    } | {
        @statusCode statusCode: 404;
        @body body: CommentError;
    } | {
        @statusCode statusCode: 500;
        @body body: CommentError;
    };
}

@route("/reports")
@tag("Comments")
interface Reports {
    @doc("""
        Report a public bookmark or a comment.

        Idempotent per reporter per target: reporting the same thing twice is
        one report and returns 200 either way. A second press is not a second
        signal, and treating it as one would let a single account flood the
        review queue.
        """)
    @useAuth(BearerAuth)
    @post
    create(@body request: CreateReportRequest): CreateReportResponse | {
        @doc("Neither target given, both given, or an empty reason.")
        @statusCode
        statusCode: 400;

        @body body: CommentError;
    } | {
        @doc("The reported thing does not exist, or is not visible to the caller.")
        @statusCode
        statusCode: 404;

        @body body: CommentError;
    } | {
        @statusCode statusCode: 500;
        @body body: CommentError;
    };
}
