# ExploreApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**exploreList**](ExploreApi.md#explorelist) | **GET** /explore |  |
| [**exploreRail**](ExploreApi.md#explorerail) | **GET** /explore/rail |  |



## exploreList

> ExploreResponse exploreList(topic, limit, cursor)



Public saves ranked for discovery, plus the topic control\&#39;s options.  Excludes the caller\&#39;s own saves - Explore is where you find what you do not already have - and everything either side of a block.

### Example

```ts
import {
  Configuration,
  ExploreApi,
} from '@cosmic-dolphin/api-client';
import type { ExploreListRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExploreApi(config);

  const body = {
    // string | Restrict to one `cosmicTags` entry, matched case-insensitively. Absent means every topic. (optional)
    topic: topic_example,
    // number | Page size. 20 is the product default; 50 is the ceiling. (optional)
    limit: 56,
    // string | Opaque keyset cursor taken verbatim from the previous page\'s `nextCursor`. (optional)
    cursor: cursor_example,
  } satisfies ExploreListRequest;

  try {
    const data = await api.exploreList(body);
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
| **topic** | `string` | Restrict to one &#x60;cosmicTags&#x60; entry, matched case-insensitively. Absent means every topic. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Page size. 20 is the product default; 50 is the ceiling. | [Optional] [Defaults to `20`] |
| **cursor** | `string` | Opaque keyset cursor taken verbatim from the previous page\&#39;s &#x60;nextCursor&#x60;. | [Optional] [Defaults to `undefined`] |

### Return type

[**ExploreResponse**](ExploreResponse.md)

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


## exploreRail

> ExploreRailResponse exploreRail(collectionLimit, peopleLimit)



Trending collections and people to follow. One request, because it is one column.

### Example

```ts
import {
  Configuration,
  ExploreApi,
} from '@cosmic-dolphin/api-client';
import type { ExploreRailRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExploreApi(config);

  const body = {
    // number (optional)
    collectionLimit: 56,
    // number (optional)
    peopleLimit: 56,
  } satisfies ExploreRailRequest;

  try {
    const data = await api.exploreRail(body);
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
| **collectionLimit** | `number` |  | [Optional] [Defaults to `4`] |
| **peopleLimit** | `number` |  | [Optional] [Defaults to `5`] |

### Return type

[**ExploreRailResponse**](ExploreRailResponse.md)

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

