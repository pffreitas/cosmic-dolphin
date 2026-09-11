# DigestsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**digestsGet**](DigestsApi.md#digestsget) | **GET** /digests/{id} |  |
| [**digestsLike**](DigestsApi.md#digestslike) | **PUT** /digests/{id}/like |  |
| [**digestsShare**](DigestsApi.md#digestsshare) | **PUT** /digests/{id}/share |  |
| [**digestsUnlike**](DigestsApi.md#digestsunlike) | **DELETE** /digests/{id}/like |  |
| [**digestsUnshare**](DigestsApi.md#digestsunshare) | **DELETE** /digests/{id}/share |  |



## digestsGet

> Digest digestsGet(id)



Get one digest.  Owner-unless-public, matching the table\&#39;s RLS: the owner always sees their own digest, and everyone else sees it only once it has been shared. Anything else is a 404 rather than a 403 — a private digest does not confirm its own existence.

### Example

```ts
import {
  Configuration,
  DigestsApi,
} from '@cosmic-dolphin/api-client';
import type { DigestsGetRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DigestsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies DigestsGetRequest;

  try {
    const data = await api.digestsGet(body);
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

[**Digest**](Digest.md)

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


## digestsLike

> LikeResponse digestsLike(id)



Like a digest

### Example

```ts
import {
  Configuration,
  DigestsApi,
} from '@cosmic-dolphin/api-client';
import type { DigestsLikeRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DigestsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies DigestsLikeRequest;

  try {
    const data = await api.digestsLike(body);
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
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## digestsShare

> ShareDigestResponse digestsShare(id)



Share a digest — the feed\&#39;s **Save digest** action.  Resharing a digest saves **the digest**, not its sources. This route publishes the digest itself and never changes the visibility of a single source bookmark: the sources are the user\&#39;s private library, and a provenance row is not a licence to publish what it names.

### Example

```ts
import {
  Configuration,
  DigestsApi,
} from '@cosmic-dolphin/api-client';
import type { DigestsShareRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DigestsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies DigestsShareRequest;

  try {
    const data = await api.digestsShare(body);
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

[**ShareDigestResponse**](ShareDigestResponse.md)

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


## digestsUnlike

> LikeResponse digestsUnlike(id)



Unlike a digest

### Example

```ts
import {
  Configuration,
  DigestsApi,
} from '@cosmic-dolphin/api-client';
import type { DigestsUnlikeRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DigestsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies DigestsUnlikeRequest;

  try {
    const data = await api.digestsUnlike(body);
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
| **404** | The server cannot find the requested resource. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## digestsUnshare

> ShareDigestResponse digestsUnshare(id)



Unshare a digest (make it private again)

### Example

```ts
import {
  Configuration,
  DigestsApi,
} from '@cosmic-dolphin/api-client';
import type { DigestsUnshareRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DigestsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies DigestsUnshareRequest;

  try {
    const data = await api.digestsUnshare(body);
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

[**ShareDigestResponse**](ShareDigestResponse.md)

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

