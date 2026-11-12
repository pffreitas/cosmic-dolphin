import "@typespec/http";
using TypeSpec.Http;
namespace CosmicDolphinService;

@doc("Restricted bookmark create result. Contains no owner bookmark fields, including on duplicates.")
model ShareSaveResponse { id: string; message: string; alreadySaved: boolean; }
@TypeSpec.OpenAPI.oneOf
union BookmarkCreateResponse { owner: CreateBookmarkResponse, share: ShareSaveResponse }
model IssueShareKeyRequest { @minLength(1) @maxLength(200) deviceId: string; }
model IssueShareKeyResponse { id: string; @pattern("^cdsk_[A-Za-z0-9_-]{43}$") key: string; }
@tag("ShareKeys")
@route("/share-keys")
@useAuth(BearerAuth)
interface ShareKeys {
  @post issue(@body request: IssueShareKeyRequest): {
    @statusCode statusCode: 201;
    @body body: IssueShareKeyResponse;
  };
  @delete @route("/{id}") revoke(@path id: string): { @statusCode statusCode: 204; };
}
