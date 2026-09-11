# SearchApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**searchAsk**](SearchApi.md#searchaskoperation) | **POST** /search/ask |  |
| [**searchHybridSearch**](SearchApi.md#searchhybridsearch) | **GET** /search |  |



## searchAsk

> SearchAskEvent searchAsk(searchAskRequest)



Search with an AI-generated RAG answer, streamed as SSE.  The &#x60;sources&#x60; event is always emitted first. When it is empty the run stops there: an answer that cites nothing is not an answer, and the server refuses to produce one rather than leaving the client to decide whether to show it.

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '@cosmic-dolphin/api-client';
import type { SearchAskOperationRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SearchApi(config);

  const body = {
    // SearchAskRequest
    searchAskRequest: ...,
  } satisfies SearchAskOperationRequest;

  try {
    const data = await api.searchAsk(body);
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
| **searchAskRequest** | [SearchAskRequest](SearchAskRequest.md) |  | |

### Return type

[**SearchAskEvent**](SearchAskEvent.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `text/event-stream`, `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **400** | The server could not understand the request due to invalid syntax. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## searchHybridSearch

> HybridSearchResponse searchHybridSearch(q, limit, collectionId, tag, readStatus, dateRange)



Hybrid search combining full-text and vector similarity

### Example

```ts
import {
  Configuration,
  SearchApi,
} from '@cosmic-dolphin/api-client';
import type { SearchHybridSearchRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SearchApi(config);

  const body = {
    // string | Search query string
    q: q_example,
    // number | Maximum number of results to return (optional)
    limit: 56,
    // string | Only saves filed directly in this collection. (optional)
    collectionId: collectionId_example,
    // string | Only saves carrying this tag, matched case-insensitively. (optional)
    tag: tag_example,
    // SearchReadStatus | Read-state filter. Defaults to `all`. (optional)
    readStatus: ...,
    // SearchDateRange | How far back to look, by save date. Defaults to `any`. (optional)
    dateRange: ...,
  } satisfies SearchHybridSearchRequest;

  try {
    const data = await api.searchHybridSearch(body);
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
| **q** | `string` | Search query string | [Defaults to `undefined`] |
| **limit** | `number` | Maximum number of results to return | [Optional] [Defaults to `20`] |
| **collectionId** | `string` | Only saves filed directly in this collection. | [Optional] [Defaults to `undefined`] |
| **tag** | `string` | Only saves carrying this tag, matched case-insensitively. | [Optional] [Defaults to `undefined`] |
| **readStatus** | `SearchReadStatus` | Read-state filter. Defaults to &#x60;all&#x60;. | [Optional] [Defaults to `undefined`] [Enum: all, unread, read] |
| **dateRange** | `SearchDateRange` | How far back to look, by save date. Defaults to &#x60;any&#x60;. | [Optional] [Defaults to `undefined`] [Enum: any, week, month, year] |

### Return type

[**HybridSearchResponse**](HybridSearchResponse.md)

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

