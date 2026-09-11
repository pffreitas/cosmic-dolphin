# ReadingApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**highlightsRemove**](ReadingApi.md#highlightsremove) | **DELETE** /highlights/{id} |  |
| [**highlightsUpdate**](ReadingApi.md#highlightsupdate) | **PATCH** /highlights/{id} |  |
| [**readingContinueReading**](ReadingApi.md#readingcontinuereading) | **GET** /bookmarks/continue-reading |  |
| [**readingCreateHighlight**](ReadingApi.md#readingcreatehighlight) | **POST** /bookmarks/{id}/highlights |  |
| [**readingGetProgress**](ReadingApi.md#readinggetprogress) | **GET** /bookmarks/{id}/progress |  |
| [**readingListHighlights**](ReadingApi.md#readinglisthighlights) | **GET** /bookmarks/{id}/highlights |  |
| [**readingSaveProgress**](ReadingApi.md#readingsaveprogress) | **PUT** /bookmarks/{id}/progress |  |



## highlightsRemove

> DeleteHighlightResponse highlightsRemove(id)



Remove a highlight.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { HighlightsRemoveRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies HighlightsRemoveRequest;

  try {
    const data = await api.highlightsRemove(body);
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

[**DeleteHighlightResponse**](DeleteHighlightResponse.md)

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


## highlightsUpdate

> Highlight highlightsUpdate(id, updateHighlightRequest)



Edit a highlight\&#39;s note. The anchor itself is never rewritten.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { HighlightsUpdateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: id_example,
    // UpdateHighlightRequest
    updateHighlightRequest: ...,
  } satisfies HighlightsUpdateRequest;

  try {
    const data = await api.highlightsUpdate(body);
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
| **updateHighlightRequest** | [UpdateHighlightRequest](UpdateHighlightRequest.md) |  | |

### Return type

[**Highlight**](Highlight.md)

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


## readingContinueReading

> ContinueReadingResponse readingContinueReading(limit)



The caller\&#39;s in-flight reads, newest activity first, for Home\&#39;s Continue reading rail.  In flight means 5-95%: below that a bookmark was opened rather than started, above it the product offers to mark it read. A bookmark the user has explicitly marked read or archived leaves the rail whatever its scroll position says - the rail is for things they mean to come back to.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { ReadingContinueReadingRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // number (optional)
    limit: 56,
  } satisfies ReadingContinueReadingRequest;

  try {
    const data = await api.readingContinueReading(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `12`] |

### Return type

[**ContinueReadingResponse**](ContinueReadingResponse.md)

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


## readingCreateHighlight

> Highlight readingCreateHighlight(id, createHighlightRequest)



Keep a span of a bookmark\&#39;s extracted content. Only on the caller\&#39;s own save - a highlight is a note about oneself and needs somewhere private to live.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { ReadingCreateHighlightRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: id_example,
    // CreateHighlightRequest
    createHighlightRequest: ...,
  } satisfies ReadingCreateHighlightRequest;

  try {
    const data = await api.readingCreateHighlight(body);
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
| **createHighlightRequest** | [CreateHighlightRequest](CreateHighlightRequest.md) |  | |

### Return type

[**Highlight**](Highlight.md)

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
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## readingGetProgress

> GetReadingProgressResponse readingGetProgress(id)



Where the caller left off in one bookmark.  The counterpart to &#x60;saveProgress&#x60;, and the reason progress survives a reload: the reader asks for it once on mount and restores the scroll position before it starts recording a new one. &#x60;continueReading&#x60; cannot answer this - it is windowed to 5-95% and to a page of items, so a reader 2% or 97% into an article would be told they had never opened it.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { ReadingGetProgressRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies ReadingGetProgressRequest;

  try {
    const data = await api.readingGetProgress(body);
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

[**GetReadingProgressResponse**](GetReadingProgressResponse.md)

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


## readingListHighlights

> GetHighlightsResponse readingListHighlights(id)



The caller\&#39;s own highlights on a bookmark. Never anyone else\&#39;s, on a public bookmark or otherwise.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { ReadingListHighlightsRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies ReadingListHighlightsRequest;

  try {
    const data = await api.readingListHighlights(body);
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

[**GetHighlightsResponse**](GetHighlightsResponse.md)

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


## readingSaveProgress

> SaveReadingProgressResponse readingSaveProgress(id, saveReadingProgressRequest)



Record how far into a bookmark the reader has got.  High frequency, and built for it: the client throttles to one write per bookmark per 5 seconds plus one on unmount, and the handler is a single guarded upsert.  Percent is **monotonic server-side**. A value below the stored one is refused in SQL - &#x60;WHERE excluded.percent &gt;&#x3D; stored.percent&#x60; - so a stale request that overtakes a fresh one, or a second tab scrolled back to the top, cannot walk progress backwards. The response is 200 either way, carrying what is actually stored and &#x60;accepted: false&#x60; when the submitted value lost.

### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '@cosmic-dolphin/api-client';
import type { ReadingSaveProgressRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: id_example,
    // SaveReadingProgressRequest
    saveReadingProgressRequest: ...,
  } satisfies ReadingSaveProgressRequest;

  try {
    const data = await api.readingSaveProgress(body);
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
| **saveReadingProgressRequest** | [SaveReadingProgressRequest](SaveReadingProgressRequest.md) |  | |

### Return type

[**SaveReadingProgressResponse**](SaveReadingProgressResponse.md)

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
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

