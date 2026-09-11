# CommentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bookmarkCommentsCreate**](CommentsApi.md#bookmarkcommentscreate) | **POST** /bookmarks/{id}/comments |  |
| [**bookmarkCommentsList**](CommentsApi.md#bookmarkcommentslist) | **GET** /bookmarks/{id}/comments |  |
| [**commentsRemove**](CommentsApi.md#commentsremove) | **DELETE** /comments/{id} |  |
| [**commentsUpdate**](CommentsApi.md#commentsupdate) | **PATCH** /comments/{id} |  |
| [**reportsCreate**](CommentsApi.md#reportscreate) | **POST** /reports |  |



## bookmarkCommentsCreate

> Comment bookmarkCommentsCreate(id, createCommentRequest)



Post a comment or a reply. Rate limited to 10 per minute.  A &#x60;parentId&#x60; that points at a reply is not an error: the new comment attaches to that reply\&#39;s parent, and the response says where it actually landed.

### Example

```ts
import {
  Configuration,
  CommentsApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarkCommentsCreateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CommentsApi(config);

  const body = {
    // string
    id: id_example,
    // CreateCommentRequest
    createCommentRequest: ...,
  } satisfies BookmarkCommentsCreateRequest;

  try {
    const data = await api.bookmarkCommentsCreate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **createCommentRequest** | [CreateCommentRequest](CreateCommentRequest.md) |  | |

### Return type

[**Comment**](Comment.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The request has succeeded and a new resource has been created as a result. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarkCommentsList

> CommentsResponse bookmarkCommentsList(id)



The thread on a bookmark, chronological.  Visible when the bookmark is public or the caller owns it — a comment on a private bookmark is a private note to self. Un-sharing therefore *hides* a thread rather than deleting it: this route starts answering 404 to everyone but the owner, and re-sharing brings the same comments back.

### Example

```ts
import {
  Configuration,
  CommentsApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarkCommentsListRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CommentsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarkCommentsListRequest;

  try {
    const data = await api.bookmarkCommentsList(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**CommentsResponse**](CommentsResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## commentsRemove

> DeleteCommentResponse commentsRemove(id)



Delete a comment.  Soft-deletes when it has replies — the row stays as a tombstone so those replies keep a parent — and hard-deletes when it does not. Unlike editing, deleting never expires: a person can always withdraw what they said.

### Example

```ts
import {
  Configuration,
  CommentsApi,
} from '@cosmic-dolphin/api-client';
import type { CommentsRemoveRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CommentsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies CommentsRemoveRequest;

  try {
    const data = await api.commentsRemove(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**DeleteCommentResponse**](DeleteCommentResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## commentsUpdate

> Comment commentsUpdate(id, updateCommentRequest)



Edit a comment, for 15 minutes after it was written and not a second longer.  The window is a product decision, not a technical one: a comment people have already replied to should not be able to become a different comment underneath them. 403 once it closes, because the caller is the author — it is the comment that is frozen, not the caller who is unauthorised.

### Example

```ts
import {
  Configuration,
  CommentsApi,
} from '@cosmic-dolphin/api-client';
import type { CommentsUpdateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CommentsApi(config);

  const body = {
    // string
    id: id_example,
    // UpdateCommentRequest
    updateCommentRequest: ...,
  } satisfies CommentsUpdateRequest;

  try {
    const data = await api.commentsUpdate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **updateCommentRequest** | [UpdateCommentRequest](UpdateCommentRequest.md) |  | |

### Return type

[**Comment**](Comment.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **403** | Access is forbidden. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## reportsCreate

> CreateReportResponse reportsCreate(createReportRequest)



Report a public bookmark or a comment.  Idempotent per reporter per target: reporting the same thing twice is one report and returns 200 either way. A second press is not a second signal, and treating it as one would let a single account flood the review queue.

### Example

```ts
import {
  Configuration,
  CommentsApi,
} from '@cosmic-dolphin/api-client';
import type { ReportsCreateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CommentsApi(config);

  const body = {
    // CreateReportRequest
    createReportRequest: ...,
  } satisfies ReportsCreateRequest;

  try {
    const data = await api.reportsCreate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **createReportRequest** | [CreateReportRequest](CreateReportRequest.md) |  | |

### Return type

[**CreateReportResponse**](CreateReportResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

