# SharedBookmarksApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**sharedBookmarksFindBySlug**](SharedBookmarksApi.md#sharedbookmarksfindbyslug) | **GET** /bookmarks/shared/{slug} |  |



## sharedBookmarksFindBySlug

> Bookmark sharedBookmarksFindBySlug(slug)



Get a publicly shared bookmark by its share slug

### Example

```ts
import {
  Configuration,
  SharedBookmarksApi,
} from '@cosmic-dolphin/api-client';
import type { SharedBookmarksFindBySlugRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const api = new SharedBookmarksApi();

  const body = {
    // string
    slug: slug_example,
  } satisfies SharedBookmarksFindBySlugRequest;

  try {
    const data = await api.sharedBookmarksFindBySlug(body);
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
| **slug** | `string` |  | [Defaults to `undefined`] |

### Return type

[**Bookmark**](Bookmark.md)

### Authorization

No authorization required

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

