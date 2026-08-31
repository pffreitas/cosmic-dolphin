import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    What the reader said about an item they did not want -
    docs/functional-spec/05-feed.md § Feedback.

    Three kinds, and they are not three flavours of the same thing:

     - `not_interested` is about **this item**. It carries `bookmarkId` and
       nothing else, and the item never appears again in any scope.
     - `fewer_domain` is about a **source**. It carries `domain`, and it is a
       weight rather than a ban — "fewer", not "none", is what the menu says
       and what the ranker does.
     - `mute_topic` is about a **subject**. It carries `topic`, and everything
       tagged with it leaves the feed until the user unmutes it.

    Dismissal outweighs any positive signal by three to one
    (`dismissalWeight`), because a person who takes the trouble to tell a feed
    it is wrong is giving it better evidence than a click ever does.
    """)
enum FeedFeedbackKind {
    not_interested,
    fewer_domain,
    mute_topic,
}

@doc("""
    One piece of feedback. Exactly one target field is required, and which one
    is decided by `kind` — a `fewer_domain` with only a `bookmarkId` is a 400,
    not a best effort, because guessing which domain the reader meant is
    exactly the kind of "helpfulness" that mutes the wrong source.
    """)
model FeedFeedbackRequest {
    kind: FeedFeedbackKind;

    @doc("Required for `not_interested`. The item being dismissed.")
    bookmarkId?: string;

    @doc("Required for `fewer_domain`. Bare host, `www.` stripped: `every.to`.")
    domain?: string;

    @doc("Required for `mute_topic`. One `cosmicTags` entry, matched case-insensitively.")
    topic?: string;
}

@doc("""
    What was recorded, echoed back.

    Idempotent: sending the same feedback twice records one row and returns the
    same answer. The ranked head is dropped as part of the write, which is what
    makes "takes effect on the next request" true rather than aspirational —
    without it the reader would keep seeing the dismissed item for the
    remainder of the five-minute cache and reasonably conclude nothing
    happened.
    """)
model FeedFeedbackResponse {
    kind: FeedFeedbackKind;
    bookmarkId?: string;
    domain?: string;
    topic?: string;

    @doc("True when the cached ranking was dropped, so the next request is recomputed.")
    rankingInvalidated: boolean;
}

@doc("A tag the reader has been saving this week, and how many times.")
model FeedRailTopic {
    topic: string;
    count: int32;
}

@doc("""
    Someone the reader follows, with what they have published in the last
    seven days.

    `savesThisWeek` counts **public** saves only, which is the same number
    anyone could count by opening the person's profile. A rail that reported
    private activity would be leaking a library one integer at a time.
    """)
model FeedRailPerson {
    person: FeedActor;
    savesThisWeek: int32;
}

@doc("""
    Home's rail, in one request - docs/design-system/pages.md § Home.

    Continue reading is deliberately **not** here: it already has a route
    (`GET /bookmarks/continue-reading`) and duplicating it would give the same
    list two definitions of "part-way through".

    Nothing in the rail is unique to it. Below 900px the rail is not rendered
    at all, and every destination it offers is reachable from Library, search,
    or a profile — so a failure here dims a column rather than costing the
    reader anything.
    """)
model FeedRailResponse {
    topics: FeedRailTopic[];
    people: FeedRailPerson[];
}

model FeedError {
    error: string;
}

@route("/feed")
@tag("Feed")
interface Feed {
    @doc("""
        Tell the ranker it got one wrong — docs/functional-spec/05-feed.md
        § Feedback.

        Reached from each feed item's overflow menu. Takes effect on the next
        request, visibly: a dismissed item that comes back is a bug, not a
        ranking nuance.
        """)
    @useAuth(BearerAuth)
    @post
    @route("/feedback")
    feedback(@body request: FeedFeedbackRequest): FeedFeedbackResponse | {
        @doc("Unknown `kind`, or the target field that `kind` requires is missing or malformed.")
        @statusCode
        statusCode: 400;

        @body body: FeedError;
    } | {
        @statusCode statusCode: 500;
        @body body: FeedError;
    };

    @doc("""
        Home's rail: the topics the reader has been saving this week, and the
        people they follow with their public output for the week.

        One request rather than three, because the rail is one column and a
        column that arrives in three pieces reflows twice.
        """)
    @useAuth(BearerAuth)
    @get
    @route("/rail")
    rail(
        @doc("How many topics to return. 6 is what the rail renders.")
        @query
        topicLimit?: int32 = 6,

        @doc("How many people to return. 5 is what the rail renders.")
        @query
        peopleLimit?: int32 = 5,
    ): FeedRailResponse | {
        @statusCode statusCode: 400;
        @body body: FeedError;
    } | {
        @statusCode statusCode: 500;
        @body body: FeedError;
    };
}
