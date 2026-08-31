import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    One bookmark a digest was built from - docs/functional-spec/05-feed.md
    § Digests.

    This model is the contract behind the `Built from` provenance row, and the
    reason it carries a `url` and a `domain` as well as an id: the row renders
    a favicon chip and a domain *as a link*, and a client that had only the id
    would have to fetch every source to draw the one line that makes the digest
    trustworthy.

    A digest names **every** bookmark it was built from. `Digest.sources` is
    never truncated server-side; the `+n more` tail in the UI is a display
    decision taken over a complete list.
    """)
model DigestSource {
    bookmarkId: string;

    title: string;

    @doc("The bookmark's `sourceUrl` — what the provenance link points at.")
    url: string;

    @doc("Bare domain, e.g. `every.to`. Derived server-side from `url`.")
    domain: string;

    faviconUrl?: string;
}

@doc("""
    One finding in a digest.

    Findings, **not a sequence**: the UI renders them with a dot marker and
    never numbers them, because numbering claims an order the content does not
    have (docs/design-system/patterns.md § AI callout).
    """)
model DigestKeyPoint {
    @doc("Optional lead-in run, rendered in `--cd-fg`: \"Memory beats context.\"")
    term?: string;

    text: string;
}

@doc("""
    An AI-authored feed item that groups 3-6 of the user's own recent saves
    into a single observation - docs/functional-spec/05-feed.md § Digests.

    Generated on a schedule per user by the worker, by clustering the last 14
    days of saves on embedding proximity and asking the model for a thesis plus
    2-3 key points **only when the cluster is genuinely coherent**. A weak
    cluster produces no digest at all, which is why there is no "confidence" or
    "quality" field here: a digest that exists has already passed the bar, and
    a digest that did not pass it was never written.

    A digest is a **first-class social object**. It has its own likes, its own
    share link, and its own detail route. Sharing one shares the digest, not
    its sources: the source bookmarks' visibility is never touched by anything
    done to the digest.
    """)
model Digest {
    id: string;

    @doc("The observation, in one line: \"Four of your saves are circling the same argument.\"")
    title: string;

    @doc("A short paragraph stating the thesis the sources share.")
    summary: string;

    @doc("2-3 findings. Rendered with dots, never numbered.")
    keyPoints: DigestKeyPoint[];

    @doc("Every bookmark this digest was built from, in cluster order. Never truncated.")
    sources: DigestSource[];

    @doc("""
        The measured mean pairwise cosine similarity of the cluster the digest
        was written from, 0..1. Returned for the same reason `signals` is
        returned on a feed item: so the threshold that produced this digest can
        be read off a response rather than argued about.
        """)
    coherence: float32;

    createdAt: utcDateTime;

    likeCount: int32;
    isLikedByCurrentUser: boolean;

    @doc("Whether the digest has been shared. A private digest is visible only to its owner.")
    isPublic: boolean;

    @doc("Present once the digest has been shared.")
    shareUrl?: string;
}

model ShareDigestResponse {
    isPublic: boolean;
    shareUrl: string;
}

model DigestError {
    error: string;
}

@route("/digests")
@tag("Digests")
interface Digests {
    @doc("""
        Get one digest.

        Owner-unless-public, matching the table's RLS: the owner always sees
        their own digest, and everyone else sees it only once it has been
        shared. Anything else is a 404 rather than a 403 — a private digest
        does not confirm its own existence.
        """)
    @useAuth(BearerAuth)
    @get
    @route("/{id}")
    get(@path id: string): Digest | {
        @statusCode statusCode: 404;
        @body body: DigestError;
    } | {
        @statusCode statusCode: 500;
        @body body: DigestError;
    };

    @doc("Like a digest")
    @useAuth(BearerAuth)
    @put
    @route("/{id}/like")
    like(@path id: string): LikeResponse | {
        @statusCode statusCode: 404;
        @body body: DigestError;
    } | {
        @statusCode statusCode: 500;
        @body body: DigestError;
    };

    @doc("Unlike a digest")
    @useAuth(BearerAuth)
    @delete
    @route("/{id}/like")
    unlike(@path id: string): LikeResponse | {
        @statusCode statusCode: 404;
        @body body: DigestError;
    } | {
        @statusCode statusCode: 500;
        @body body: DigestError;
    };

    @doc("""
        Share a digest — the feed's **Save digest** action.

        Resharing a digest saves **the digest**, not its sources. This route
        publishes the digest itself and never changes the visibility of a
        single source bookmark: the sources are the user's private library, and
        a provenance row is not a licence to publish what it names.
        """)
    @useAuth(BearerAuth)
    @put
    @route("/{id}/share")
    share(@path id: string): ShareDigestResponse | {
        @statusCode statusCode: 404;
        @body body: DigestError;
    } | {
        @statusCode statusCode: 500;
        @body body: DigestError;
    };

    @doc("Unshare a digest (make it private again)")
    @useAuth(BearerAuth)
    @delete
    @route("/{id}/share")
    unshare(@path id: string): ShareDigestResponse | {
        @statusCode statusCode: 404;
        @body body: DigestError;
    } | {
        @statusCode statusCode: 500;
        @body body: DigestError;
    };
}
