import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("""
    A profile as anyone is allowed to see it.

    **There is no `email` field here, and there must never be one**
    (docs/functional-spec/06-social.md § Profiles). This is not a rule the
    handlers remember to apply: the repository selects an explicit column list
    that omits `email`, `PublicProfile` in `packages/shared` is a standalone
    type rather than an `Omit<Profile, "email">` that would inherit new fields
    for free, and a compile-time assertion fails the build if the field ever
    appears. This model is the fourth lock, and the one a client can see.
    """)
model PublicProfile {
    id: string;

    @doc("The stable public identity. `/u/{handle}` is the canonical profile URL.")
    handle: string;

    name?: string;
    pictureUrl?: string;

    @doc("When the account was created. The only date a public profile carries.")
    joinedAt: utcDateTime;

    counts: PublicProfileCounts;

    @doc("True when this profile is the caller's own.")
    isSelf: boolean;

    @doc("True when the caller follows this profile. Absent on anonymous reads and in list responses, where the relationship is not computed per row.")
    isFollowedByViewer?: boolean;

    @doc("True when this profile follows the caller.")
    followsViewer?: boolean;

    @doc("True when the caller has blocked this profile. A blocked profile stays reachable so the block can be undone from it; its saves do not.")
    isBlockedByViewer?: boolean;
}

@doc("Public counts only. The size of someone's private library is theirs.")
model PublicProfileCounts {
    followers: int32;
    following: int32;
    publicSaves: int32;
    collections: int32;
}

@doc("""
    The caller's own profile.

    The only profile shape that carries an email, because it is the caller's
    own. Everything anyone else sees is a `PublicProfile`.
    """)
model Profile {
    id: string;
    name?: string;
    email?: string;
    pictureUrl?: string;

    @doc("Absent only in the degraded case where a handle could not be minted at signup.")
    handle?: string;

    @doc("""
        False when the handle was reserved from the email local part at signup
        or by the backfill, and never confirmed by a person.

        This is what the claim prompt hangs off: existing accounts were given a
        working handle so `/u/{handle}` and `/my/profile` never broke, and are
        asked to confirm or change it once.
        """)
    handleClaimed: boolean;

    @doc("When the handle may next be changed. Absent when it may be changed now. Confirming a reserved handle unchanged is not a change and does not start the clock.")
    handleChangeAvailableAt?: utcDateTime;

    createdAt: utcDateTime;
    updatedAt: utcDateTime;
}

@doc("""
    Name, picture and handle. Every field is optional; an absent field is left
    alone and an explicit `null` on name or picture clears it.
    """)
model UpdateProfileRequest {
    name?: string | null;
    pictureUrl?: string | null;

    @doc("Lowercase letters, numbers and underscores, 3-30 characters. Changeable once every 30 days.")
    handle?: string;
}

@doc("The state after the call, so an optimistic client can reconcile rather than guess.")
model FollowResponse {
    following: boolean;

    @doc("The target's follower count after the call.")
    followerCount: int32;
}

model BlockResponse {
    blocked: boolean;
}

model PublicSavesResponse {
    bookmarks: Bookmark[];

    @doc("Absent when this page is the last one.")
    nextCursor?: string;
}

model PublicProfileListResponse {
    profiles: PublicProfile[];

    @doc("Absent when this page is the last one.")
    nextCursor?: string;
}

model SocialError {
    error: string;
}

@route("/profile")
@tag("Social")
interface Profiles {
    @doc("The caller's own profile, including the handle and whether it has been claimed.")
    @useAuth(BearerAuth)
    @get
    get(): Profile | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("""
        Update name, picture, or handle.

        The handle rules live here and nowhere else: format
        `^[a-z0-9_]{3,30}$`, unique, and changeable once every 30 days. A
        request that sets `handle` to the value it already has *claims* the
        reserved handle without spending the 30-day allowance - confirming
        something is not changing it.
        """)
    @useAuth(BearerAuth)
    @patch
    update(@body request: UpdateProfileRequest): Profile | {
        @doc("The handle is the wrong shape, or a field is not a string.")
        @statusCode
        statusCode: 400;

        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @doc("The handle is taken, or was changed less than 30 days ago.")
        @statusCode
        statusCode: 409;

        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };
}

@route("/users")
@tag("Social")
interface Users {
    @doc("""
        A public profile by handle.

        Keyed on the handle rather than the id so a profile link survives being
        pasted somewhere. 404 - never 403 - when the profile has blocked the
        caller: a 403 would confirm both that the account exists and that
        something about the caller is why they cannot see it, which is exactly
        what a block withholds.
        """)
    @useAuth(BearerAuth)
    @get
    @route("/{handle}")
    getProfile(@path handle: string): PublicProfile | {
        @doc("No such handle, or the profile has blocked the caller.")
        @statusCode
        statusCode: 404;

        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("A profile's public saves, newest first. Never their private ones, and never anything at all to a user they have blocked.")
    @useAuth(BearerAuth)
    @get
    @route("/{handle}/saves")
    getSaves(
        @path handle: string,
        @query limit?: int32 = 24,

        @doc("Opaque keyset cursor from the previous page.")
        @query
        cursor?: string,
    ): PublicSavesResponse | {
        @statusCode statusCode: 400;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("Who follows this profile, newest follower first.")
    @useAuth(BearerAuth)
    @get
    @route("/{handle}/followers")
    getFollowers(
        @path handle: string,
        @query limit?: int32 = 24,
        @query cursor?: string,
    ): PublicProfileListResponse | {
        @statusCode statusCode: 400;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("Who this profile follows, most recently followed first.")
    @useAuth(BearerAuth)
    @get
    @route("/{handle}/following")
    getFollowing(
        @path handle: string,
        @query limit?: int32 = 24,
        @query cursor?: string,
    ): PublicProfileListResponse | {
        @statusCode statusCode: 400;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("""
        Follow. Immediate, public, and reciprocity-free - there is no request
        and no acceptance, so the response is the final state.

        Idempotent: following twice is one edge and one follower. Rate limited
        to 100 per hour.
        """)
    @useAuth(BearerAuth)
    @put
    @route("/{handle}/follow")
    follow(@path handle: string): FollowResponse | {
        @doc("You cannot follow yourself.")
        @statusCode
        statusCode: 400;

        @body body: SocialError;
    } | {
        @doc("No such handle, or a block stands between the two accounts.")
        @statusCode
        statusCode: 404;

        @body body: SocialError;
    } | {
        @doc("Follow rate limit exceeded. Carries `Retry-After`, in seconds.")
        @statusCode
        statusCode: 429;

        @header("Retry-After") retryAfter?: int32;

        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("Unfollow. Immediate and silent - the followed user is not notified.")
    @useAuth(BearerAuth)
    @delete
    @route("/{handle}/follow")
    unfollow(@path handle: string): FollowResponse | {
        @statusCode statusCode: 400;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 429;
        @header("Retry-After") retryAfter?: int32;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("""
        Block. Drops both follow edges in the same transaction and hides the
        blocker's public saves from the blocked user.

        Being blocked by someone does not stop you blocking them back, so this
        route - unlike `follow` - does not 404 on an existing block.
        """)
    @useAuth(BearerAuth)
    @put
    @route("/{handle}/block")
    block(@path handle: string): BlockResponse | {
        @doc("You cannot block yourself.")
        @statusCode
        statusCode: 400;

        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };

    @doc("Unblock. Does not restore the follow edges the block removed - those were deleted, and re-following is the user's decision to make again.")
    @useAuth(BearerAuth)
    @delete
    @route("/{handle}/block")
    unblock(@path handle: string): BlockResponse | {
        @statusCode statusCode: 400;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 404;
        @body body: SocialError;
    } | {
        @statusCode statusCode: 500;
        @body body: SocialError;
    };
}
