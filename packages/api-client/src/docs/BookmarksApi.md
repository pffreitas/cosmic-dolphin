# BookmarksApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bookmarksCounts**](BookmarksApi.md#bookmarkscounts) | **GET** /bookmarks/counts |  |
| [**bookmarksCreate**](BookmarksApi.md#bookmarkscreate) | **POST** /bookmarks |  |
| [**bookmarksFeed**](BookmarksApi.md#bookmarksfeed) | **GET** /bookmarks/feed |  |
| [**bookmarksFindById**](BookmarksApi.md#bookmarksfindbyid) | **GET** /bookmarks/{id} |  |
| [**bookmarksGetProcessingTimeline**](BookmarksApi.md#bookmarksgetprocessingtimeline) | **GET** /bookmarks/{id}/processing-timeline |  |
| [**bookmarksLike**](BookmarksApi.md#bookmarkslike) | **PUT** /bookmarks/{id}/like |  |
| [**bookmarksList**](BookmarksApi.md#bookmarkslist) | **GET** /bookmarks |  |
| [**bookmarksMarkRead**](BookmarksApi.md#bookmarksmarkread) | **PUT** /bookmarks/{id}/read |  |
| [**bookmarksMarkUnread**](BookmarksApi.md#bookmarksmarkunread) | **DELETE** /bookmarks/{id}/read |  |
| [**bookmarksPreview**](BookmarksApi.md#bookmarkspreview) | **POST** /bookmarks/preview |  |
| [**bookmarksRefile**](BookmarksApi.md#bookmarksrefile) | **PATCH** /bookmarks/{id}/collection |  |
| [**bookmarksRemove**](BookmarksApi.md#bookmarksremove) | **DELETE** /bookmarks/{id} |  |
| [**bookmarksReprocess**](BookmarksApi.md#bookmarksreprocess) | **POST** /bookmarks/{id}/reprocess |  |
| [**bookmarksReshare**](BookmarksApi.md#bookmarksreshare) | **POST** /bookmarks/{id}/reshare |  |
| [**bookmarksSearch**](BookmarksApi.md#bookmarkssearch) | **GET** /bookmarks/search |  |
| [**bookmarksShare**](BookmarksApi.md#bookmarksshare) | **PUT** /bookmarks/{id}/share |  |
| [**bookmarksUnlike**](BookmarksApi.md#bookmarksunlike) | **DELETE** /bookmarks/{id}/like |  |
| [**bookmarksUnshare**](BookmarksApi.md#bookmarksunshare) | **DELETE** /bookmarks/{id}/share |  |
| [**bookmarksUpdate**](BookmarksApi.md#bookmarksupdate) | **PATCH** /bookmarks/{id} |  |



## bookmarksCounts

> BookmarkLibraryCounts bookmarksCounts()



The counts beside every row of the Library rail, in one query.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksCountsRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  try {
    const data = await api.bookmarksCounts();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**BookmarkLibraryCounts**](BookmarkLibraryCounts.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksCreate

> CreateBookmarkResponse bookmarksCreate(createBookmarkRequest)



Create a new bookmark.  The URL is normalised before anything else (lowercased scheme and host, trailing slash stripped, &#x60;utm_*&#x60;/&#x60;fbclid&#x60;/&#x60;gclid&#x60;/&#x60;ref&#x60;/&#x60;mc_cid&#x60; dropped); the normalised form is stored in &#x60;sourceUrl&#x60; and the paste is preserved in &#x60;metadata.originalUrl&#x60;.  If the caller already has that normalised URL, this returns 200 with &#x60;alreadySaved: true&#x60; and the existing bookmark — a duplicate paste is not an error and never a 409.  The handler writes the row and enqueues; fetching, extraction, summarising, tagging and filing all happen in the worker. Nothing is awaited that touches the network or a model.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksCreateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // CreateBookmarkRequest
    createBookmarkRequest: ...,
  } satisfies BookmarksCreateRequest;

  try {
    const data = await api.bookmarksCreate(body);
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
| **createBookmarkRequest** | [CreateBookmarkRequest](CreateBookmarkRequest.md) |  | |

### Return type

[**CreateBookmarkResponse**](CreateBookmarkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **201** | The request has succeeded and a new resource has been created as a result. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksFeed

> FeedResponse bookmarksFeed(scope, cursor, limit)



The ranked Home feed — docs/functional-spec/05-feed.md.  Not a bookmark list. Each row is a &#x60;FeedItem&#x60; that says what it is, who it came through, and — in one sentence the server wrote — why it is here.  **Cursor-based, never offset.** The candidate set is re-ranked between requests; an offset into a list that has been reordered duplicates some items and skips others. Hand &#x60;nextCursor&#x60; back verbatim.  The ranking\&#39;s head is cached per user for five minutes, which is what &#x60;computedAt&#x60; reports. Bookmarks saved after that point bypass the cache and are prepended, so a save the user just made is on the first page whatever the cache says.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksFeedRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // FeedScope | Which slice. Defaults to `for_you`. (optional)
    scope: ...,
    // string | Opaque cursor taken verbatim from the previous page\'s `nextCursor`. A cursor produced under a different `scope` is rejected with 400. (optional)
    cursor: cursor_example,
    // number | Page size. 20 is the product default; 50 is the ceiling. (optional)
    limit: 56,
  } satisfies BookmarksFeedRequest;

  try {
    const data = await api.bookmarksFeed(body);
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
| **scope** | `FeedScope` | Which slice. Defaults to &#x60;for_you&#x60;. | [Optional] [Defaults to `undefined`] [Enum: for_you, following, unread] |
| **cursor** | `string` | Opaque cursor taken verbatim from the previous page\&#39;s &#x60;nextCursor&#x60;. A cursor produced under a different &#x60;scope&#x60; is rejected with 400. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Page size. 20 is the product default; 50 is the ceiling. | [Optional] [Defaults to `20`] |

### Return type

[**FeedResponse**](FeedResponse.md)

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
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksFindById

> Bookmark bookmarksFindById(id)



Get a bookmark by ID

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksFindByIdRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksFindByIdRequest;

  try {
    const data = await api.bookmarksFindById(body);
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

[**Bookmark**](Bookmark.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksGetProcessingTimeline

> BookmarkProcessingTimelineResponse bookmarksGetProcessingTimeline(id)



Get the durable processing timeline for a bookmark

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksGetProcessingTimelineRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksGetProcessingTimelineRequest;

  try {
    const data = await api.bookmarksGetProcessingTimeline(body);
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

[**BookmarkProcessingTimelineResponse**](BookmarkProcessingTimelineResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksLike

> LikeResponse bookmarksLike(id)



Like a bookmark

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksLikeRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksLikeRequest;

  try {
    const data = await api.bookmarksLike(body);
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

[**LikeResponse**](LikeResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksList

> GetBookmarksResponse bookmarksList(collectionId, limit, offset, readStatus, scope, sort, cursor)



Get the caller\&#39;s bookmarks.  Ordered by &#x60;sort&#x60;, which defaults to &#x60;newest&#x60; - chronological, the order the Library falls back to and the one every other ordering is an overlay on.  Paging is keyset: read &#x60;nextCursor&#x60; off the response and hand it back as &#x60;cursor&#x60;. &#x60;offset&#x60; remains for callers that have not moved over, but it is not safe on a list being written to while it is paged.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksListRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string | Filter bookmarks by collection ID (optional)
    collectionId: collectionId_example,
    // number | Maximum number of bookmarks to return (optional)
    limit: 56,
    // number | Number of bookmarks to skip (optional)
    offset: 56,
    // BookmarkReadStatus | Filter bookmarks by read state (optional)
    readStatus: ...,
    // BookmarkScope | Which rail row this is. Ignored when `collection_id` names a collection. (optional)
    scope: ...,
    // BookmarkSort | Ordering. Chronological `newest` is the default. (optional)
    sort: ...,
    // string | Opaque keyset cursor taken verbatim from the previous page\'s `nextCursor`. Present, it wins over `offset` - a library is written to while it is being paged, and an offset silently duplicates and skips. A cursor produced under a different `sort` is rejected with 400. (optional)
    cursor: cursor_example,
  } satisfies BookmarksListRequest;

  try {
    const data = await api.bookmarksList(body);
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
| **collectionId** | `string` | Filter bookmarks by collection ID | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Maximum number of bookmarks to return | [Optional] [Defaults to `50`] |
| **offset** | `number` | Number of bookmarks to skip | [Optional] [Defaults to `0`] |
| **readStatus** | `BookmarkReadStatus` | Filter bookmarks by read state | [Optional] [Defaults to `undefined`] [Enum: all, unread, read] |
| **scope** | `BookmarkScope` | Which rail row this is. Ignored when &#x60;collection_id&#x60; names a collection. | [Optional] [Defaults to `undefined`] [Enum: all, inbox, archive] |
| **sort** | `BookmarkSort` | Ordering. Chronological &#x60;newest&#x60; is the default. | [Optional] [Defaults to `undefined`] [Enum: newest, oldest, recently_read, longest_unread] |
| **cursor** | `string` | Opaque keyset cursor taken verbatim from the previous page\&#39;s &#x60;nextCursor&#x60;. Present, it wins over &#x60;offset&#x60; - a library is written to while it is being paged, and an offset silently duplicates and skips. A cursor produced under a different &#x60;sort&#x60; is rejected with 400. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetBookmarksResponse**](GetBookmarksResponse.md)

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
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksMarkRead

> Bookmark bookmarksMarkRead(id)



Mark a bookmark as read

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksMarkReadRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksMarkReadRequest;

  try {
    const data = await api.bookmarksMarkRead(body);
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

[**Bookmark**](Bookmark.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksMarkUnread

> Bookmark bookmarksMarkUnread(id)



Mark a bookmark as unread

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksMarkUnreadRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksMarkUnreadRequest;

  try {
    const data = await api.bookmarksMarkUnread(body);
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

[**Bookmark**](Bookmark.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksPreview

> PreviewResponse bookmarksPreview(previewRequest)



Preview a URL and get metadata without saving

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksPreviewRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // PreviewRequest
    previewRequest: ...,
  } satisfies BookmarksPreviewRequest;

  try {
    const data = await api.bookmarksPreview(body);
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
| **previewRequest** | [PreviewRequest](PreviewRequest.md) |  | |

### Return type

[**PreviewResponse**](PreviewResponse.md)

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
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksRefile

> Bookmark bookmarksRefile(id, refileBookmarkRequest)



Move a bookmark into a collection, or to Inbox with &#x60;collectionId: null&#x60;.  This is the override endpoint. It sets &#x60;filing_source &#x3D; \&#39;user\&#39;&#x60; in the same statement as the move, so the pipeline\&#39;s &#x60;file&#x60; phase will never touch this bookmark again. A refile the pipeline can undo on its next run is worse than no refile at all.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksRefileRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
    // RefileBookmarkRequest
    refileBookmarkRequest: ...,
  } satisfies BookmarksRefileRequest;

  try {
    const data = await api.bookmarksRefile(body);
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
| **refileBookmarkRequest** | [RefileBookmarkRequest](RefileBookmarkRequest.md) |  | |

### Return type

[**Bookmark**](Bookmark.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksRemove

> DeleteBookmarkResponse bookmarksRemove(id)



Delete a bookmark and all associated data

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksRemoveRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksRemoveRequest;

  try {
    const data = await api.bookmarksRemove(body);
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

[**DeleteBookmarkResponse**](DeleteBookmarkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksReprocess

> ReprocessBookmarkResponse bookmarksReprocess(id, reprocessBookmarkRequest)



Start a fresh processing run for a bookmark, optionally scoped to one phase. Appends to the existing timeline rather than replacing it, so the run the user already watched stays on screen. Also the **Summarise now** action on a bookmark left &#x60;idle&#x60; by the daily processing budget: an explicit request is never refused for budget.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksReprocessRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
    // ReprocessBookmarkRequest
    reprocessBookmarkRequest: ...,
  } satisfies BookmarksReprocessRequest;

  try {
    const data = await api.bookmarksReprocess(body);
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
| **reprocessBookmarkRequest** | [ReprocessBookmarkRequest](ReprocessBookmarkRequest.md) |  | |

### Return type

[**ReprocessBookmarkResponse**](ReprocessBookmarkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** | The request has been accepted for processing, but processing has not yet completed. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksReshare

> CreateBookmarkResponse bookmarksReshare(id)



Reshare a bookmark into the caller\&#39;s own library — the feed\&#39;s **Save** action, docs/functional-spec/06-social.md § Reshare.  The new bookmark is the caller\&#39;s: it inherits only the source URL and carries &#x60;savedFromBookmarkId&#x60; pointing at the original. Nothing else travels. The pipeline runs again for the new owner, so the summary, tags and filing are theirs and not the original saver\&#39;s, and the comment thread stays on the original — a reshare starts at zero.  Because it inherits the URL it meets the same per-user uniqueness constraint &#x60;POST /bookmarks&#x60; does: resharing something already in the library returns 200 with &#x60;alreadySaved: true&#x60; and the row the caller already has. Nothing is created and nothing is re-queued.  404 covers \&quot;no such bookmark\&quot;, \&quot;not public\&quot;, and \&quot;blocked in either direction\&quot; alike — the same refusal the social routes make, for the same reason.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksReshareRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksReshareRequest;

  try {
    const data = await api.bookmarksReshare(body);
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

[**CreateBookmarkResponse**](CreateBookmarkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **201** | The request has succeeded and a new resource has been created as a result. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksSearch

> SearchBookmarksResponse bookmarksSearch(query, limit, offset)



Search bookmarks

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksSearchRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string | Search query string
    query: query_example,
    // number | Maximum number of bookmarks to return (optional)
    limit: 56,
    // number | Number of bookmarks to skip (optional)
    offset: 56,
  } satisfies BookmarksSearchRequest;

  try {
    const data = await api.bookmarksSearch(body);
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
| **query** | `string` | Search query string | [Defaults to `undefined`] |
| **limit** | `number` | Maximum number of bookmarks to return | [Optional] [Defaults to `50`] |
| **offset** | `number` | Number of bookmarks to skip | [Optional] [Defaults to `0`] |

### Return type

[**SearchBookmarksResponse**](SearchBookmarksResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksShare

> ShareBookmarkResponse bookmarksShare(id)



Share a bookmark (make it public)

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksShareRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksShareRequest;

  try {
    const data = await api.bookmarksShare(body);
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

[**ShareBookmarkResponse**](ShareBookmarkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksUnlike

> LikeResponse bookmarksUnlike(id)



Unlike a bookmark

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksUnlikeRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksUnlikeRequest;

  try {
    const data = await api.bookmarksUnlike(body);
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

[**LikeResponse**](LikeResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksUnshare

> ShareBookmarkResponse bookmarksUnshare(id)



Unshare a bookmark (make it private)

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksUnshareRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies BookmarksUnshareRequest;

  try {
    const data = await api.bookmarksUnshare(body);
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

[**ShareBookmarkResponse**](ShareBookmarkResponse.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookmarksUpdate

> Bookmark bookmarksUpdate(id, updateBookmarkRequest)



Update a bookmark\&#39;s title, tags, or archived flag.  This is what the Library\&#39;s bulk bar writes through for **Archive** and **Add tag**. It takes the whole tag list rather than a delta so the 8-second undo can put back exactly what was there.

### Example

```ts
import {
  Configuration,
  BookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { BookmarksUpdateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new BookmarksApi(config);

  const body = {
    // string
    id: id_example,
    // UpdateBookmarkRequest
    updateBookmarkRequest: ...,
  } satisfies BookmarksUpdateRequest;

  try {
    const data = await api.bookmarksUpdate(body);
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
| **updateBookmarkRequest** | [UpdateBookmarkRequest](UpdateBookmarkRequest.md) |  | |

### Return type

[**Bookmark**](Bookmark.md)

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

