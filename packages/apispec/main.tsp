import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

import "./notes.tsp";
import "./pipeline.tsp";
import "./bookmarks.tsp";

using TypeSpec.Http;

@service({
    title: "Cosmic Dolphin",
})
namespace CosmicDolphinService;

@error
model CosmicError {
    code: int32;
    message: string;
}

