# CollectionsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**collectionsAcceptSuggestion**](CollectionsApi.md#collectionsacceptsuggestion) | **POST** /collections/suggestions/{id}/accept |  |
| [**collectionsCreate**](CollectionsApi.md#collectionscreate) | **POST** /collections |  |
| [**collectionsDismissSuggestion**](CollectionsApi.md#collectionsdismisssuggestion) | **POST** /collections/suggestions/{id}/dismiss |  |
| [**collectionsList**](CollectionsApi.md#collectionslist) | **GET** /collections |  |
| [**collectionsListSuggestions**](CollectionsApi.md#collectionslistsuggestions) | **GET** /collections/suggestions |  |
| [**collectionsRemove**](CollectionsApi.md#collectionsremove) | **DELETE** /collections/{id} |  |
| [**collectionsUpdate**](CollectionsApi.md#collectionsupdate) | **PATCH** /collections/{id} |  |



## collectionsAcceptSuggestion

> AcceptCollectionSuggestionResponse collectionsAcceptSuggestion(id)



Accept a proposal: create the collection and file its supporting bookmarks into it. The only path by which a proposal becomes a collection.

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsAcceptSuggestionRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies CollectionsAcceptSuggestionRequest;

  try {
    const data = await api.collectionsAcceptSuggestion(body);
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

[**AcceptCollectionSuggestionResponse**](AcceptCollectionSuggestionResponse.md)

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
| **409** | The request conflicts with the current state of the server. |  -  |
| **422** | Client error |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## collectionsCreate

> Collection collectionsCreate(createCollectionRequest)



Create a collection.  The tree is capped at two levels: &#x60;parentId&#x60; must name a root collection the caller owns. A deeper parent is rejected with 422.

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsCreateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  const body = {
    // CreateCollectionRequest
    createCollectionRequest: ...,
  } satisfies CollectionsCreateRequest;

  try {
    const data = await api.collectionsCreate(body);
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
| **createCollectionRequest** | [CreateCollectionRequest](CreateCollectionRequest.md) |  | |

### Return type

[**Collection**](Collection.md)

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
| **422** | Client error |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## collectionsDismissSuggestion

> CollectionSuggestionResponse collectionsDismissSuggestion(id)



Decline a proposal. Remembered for 30 days, not forever.

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsDismissSuggestionRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies CollectionsDismissSuggestionRequest;

  try {
    const data = await api.collectionsDismissSuggestion(body);
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

[**CollectionSuggestionResponse**](CollectionSuggestionResponse.md)

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


## collectionsList

> GetCollectionsResponse collectionsList()



Get user\&#39;s collections

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsListRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  try {
    const data = await api.collectionsList();
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

[**GetCollectionsResponse**](GetCollectionsResponse.md)

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


## collectionsListSuggestions

> GetCollectionSuggestionsResponse collectionsListSuggestions()



The AI collection proposals worth answering: pending, and supported by enough bookmarks to be worth the interruption.

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsListSuggestionsRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  try {
    const data = await api.collectionsListSuggestions();
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

[**GetCollectionSuggestionsResponse**](GetCollectionSuggestionsResponse.md)

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


## collectionsRemove

> DeleteCollectionResponse collectionsRemove(id)



Delete a collection. Its bookmarks move to Inbox - they are never deleted. Child collections are removed with it, and their bookmarks move to Inbox too.

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsRemoveRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies CollectionsRemoveRequest;

  try {
    const data = await api.collectionsRemove(body);
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

[**DeleteCollectionResponse**](DeleteCollectionResponse.md)

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


## collectionsUpdate

> Collection collectionsUpdate(id, updateCollectionRequest)



Rename, recolour, or reparent a collection.  Reparenting is checked against the same two-level cap as creation, from both ends: the new parent must be a root collection, and a collection that has children of its own cannot be moved under anything.

### Example

```ts
import {
  Configuration,
  CollectionsApi,
} from '@cosmic-dolphin/api-client';
import type { CollectionsUpdateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CollectionsApi(config);

  const body = {
    // string
    id: id_example,
    // UpdateCollectionRequest
    updateCollectionRequest: ...,
  } satisfies CollectionsUpdateRequest;

  try {
    const data = await api.collectionsUpdate(body);
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
| **updateCollectionRequest** | [UpdateCollectionRequest](UpdateCollectionRequest.md) |  | |

### Return type

[**Collection**](Collection.md)

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
| **422** | Client error |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

