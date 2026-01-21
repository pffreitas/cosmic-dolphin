import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

enum PipelineStatus {
    pending: "pending",
    running: "running",
    success: "complete",
    failed: "failed",
}

model PipelineStage {
    id?: int64;
    name: string;
    key: string;
    status: PipelineStatus;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
}

model Pipeline extends Record<unknown> {
    id?: int64;
    refId?: int64;
    stages: PipelineStage[];
    status: PipelineStatus;
    createdAt: utcDateTime;
}

@route("/pipelines")
@tag("Pipelines")
interface Pipelines {
    @useAuth(BearerAuth)
    @get
    findByRefId(@path refId: int32): Pipeline[] | CosmicError;
}