import "@typespec/http";
using TypeSpec.Http;
namespace CosmicDolphinService;

model DailyPick {
    @minValue(1)
    @maxValue(5)
    position: int32;
    bookmark: Bookmark;
    @doc("The immutable server ranking reason, rendered verbatim.")
    reason: string;
}

model TodayPicksResponse {
    @doc("Starting local date of the PostgreSQL 06:00-to-06:00 pick day.")
    localDate: string;
    refreshesAt: utcDateTime;
    @doc("Present only when an immutable set has been stored, even if all slots are hidden.")
    computedAt?: utcDateTime;
    @doc("Earliest hidden pick snooze ending before refreshesAt.")
    revealsAt?: utcDateTime;
    items: DailyPick[];
}

@route("/picks")
@tag("Picks")
interface Picks {
    @useAuth(BearerAuth)
    @get
    @route("/today")
    today(@query tz: string): TodayPicksResponse | {
        @statusCode statusCode: 400;
        @body body: FeedError;
    } | {
        @statusCode statusCode: 500;
        @body body: FeedError;
    };
}
