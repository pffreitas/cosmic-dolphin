import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

model HybridSearchResultItem {
    bookmark: Bookmark;
    score: float64;
    matchedChunks: string[];
}

model HybridSearchResponse {
    results: HybridSearchResultItem[];
}

model SearchAskRequest {
    @doc("The search query / question")
    query: string;
}

model SearchError {
    error: string;
}

@route("/search")
@tag("Search")
interface Search {
    @doc("Hybrid search combining full-text and vector similarity")
    @useAuth(BearerAuth)
    @get
    hybridSearch(
        @doc("Search query string")
        @query q: string,

        @doc("Maximum number of results to return")
        @query limit?: int32 = 20,
    ): HybridSearchResponse | {
        @statusCode statusCode: 400;
        @body body: SearchError;
    } | {
        @statusCode statusCode: 500;
        @body body: SearchError;
    };

    @doc("Search with AI-generated RAG response streamed via SSE")
    @useAuth(BearerAuth)
    @post
    @route("/ask")
    ask(@body request: SearchAskRequest): {
        @statusCode statusCode: 200;
        @header contentType: "text/event-stream";
        @body body: string;
    } | {
        @statusCode statusCode: 400;
        @body body: SearchError;
    } | {
        @statusCode statusCode: 500;
        @body body: SearchError;
    };
}
