# SocialApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**profilesGet**](SocialApi.md#profilesget) | **GET** /profile |  |
| [**profilesUpdate**](SocialApi.md#profilesupdate) | **PATCH** /profile |  |
| [**usersBlock**](SocialApi.md#usersblock) | **PUT** /users/{handle}/block |  |
| [**usersFollow**](SocialApi.md#usersfollow) | **PUT** /users/{handle}/follow |  |
| [**usersGetCollections**](SocialApi.md#usersgetcollections) | **GET** /users/{handle}/collections |  |
| [**usersGetFollowers**](SocialApi.md#usersgetfollowers) | **GET** /users/{handle}/followers |  |
| [**usersGetFollowing**](SocialApi.md#usersgetfollowing) | **GET** /users/{handle}/following |  |
| [**usersGetLikes**](SocialApi.md#usersgetlikes) | **GET** /users/{handle}/likes |  |
| [**usersGetProfile**](SocialApi.md#usersgetprofile) | **GET** /users/{handle} |  |
| [**usersGetSaves**](SocialApi.md#usersgetsaves) | **GET** /users/{handle}/saves |  |
| [**usersUnblock**](SocialApi.md#usersunblock) | **DELETE** /users/{handle}/block |  |
| [**usersUnfollow**](SocialApi.md#usersunfollow) | **DELETE** /users/{handle}/follow |  |



## profilesGet

> Profile profilesGet()



The caller\&#39;s own profile, including the handle and whether it has been claimed.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { ProfilesGetRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  try {
    const data = await api.profilesGet();
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

[**Profile**](Profile.md)

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


## profilesUpdate

> Profile profilesUpdate(updateProfileRequest)



Update name, picture, or handle.  The handle rules live here and nowhere else: format &#x60;^[a-z0-9_]{3,30}$&#x60;, unique, and changeable once every 30 days. A request that sets &#x60;handle&#x60; to the value it already has *claims* the reserved handle without spending the 30-day allowance - confirming something is not changing it.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { ProfilesUpdateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // UpdateProfileRequest
    updateProfileRequest: ...,
  } satisfies ProfilesUpdateRequest;

  try {
    const data = await api.profilesUpdate(body);
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
| **updateProfileRequest** | [UpdateProfileRequest](UpdateProfileRequest.md) |  | |

### Return type

[**Profile**](Profile.md)

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
| **409** | The request conflicts with the current state of the server. |  -  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## usersBlock

> BlockResponse usersBlock(handle)



Block. Drops both follow edges in the same transaction and hides the blocker\&#39;s public saves from the blocked user.  Being blocked by someone does not stop you blocking them back, so this route - unlike &#x60;follow&#x60; - does not 404 on an existing block.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersBlockRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
  } satisfies UsersBlockRequest;

  try {
    const data = await api.usersBlock(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**BlockResponse**](BlockResponse.md)

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


## usersFollow

> FollowResponse usersFollow(handle)



Follow. Immediate, public, and reciprocity-free - there is no request and no acceptance, so the response is the final state.  Idempotent: following twice is one edge and one follower. Rate limited to 100 per hour.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersFollowRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
  } satisfies UsersFollowRequest;

  try {
    const data = await api.usersFollow(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**FollowResponse**](FollowResponse.md)

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
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## usersGetCollections

> PublicCollectionListResponse usersGetCollections(handle, limit, cursor)



A profile\&#39;s **public** collections, newest first - the Collections tab on &#x60;/u/{handle}&#x60;.  A collection is listed when &#x60;is_public&#x60; is set, whatever is filed inside it. &#x60;saveCount&#x60; then counts only the public saves in it, so a public collection full of private links reports zero rather than leaking its size.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersGetCollectionsRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
    // number (optional)
    limit: 56,
    // string (optional)
    cursor: cursor_example,
  } satisfies UsersGetCollectionsRequest;

  try {
    const data = await api.usersGetCollections(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `24`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**PublicCollectionListResponse**](PublicCollectionListResponse.md)

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


## usersGetFollowers

> PublicProfileListResponse usersGetFollowers(handle, limit, cursor)



Who follows this profile, newest follower first.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersGetFollowersRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
    // number (optional)
    limit: 56,
    // string (optional)
    cursor: cursor_example,
  } satisfies UsersGetFollowersRequest;

  try {
    const data = await api.usersGetFollowers(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `24`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**PublicProfileListResponse**](PublicProfileListResponse.md)

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


## usersGetFollowing

> PublicProfileListResponse usersGetFollowing(handle, limit, cursor)



Who this profile follows, most recently followed first.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersGetFollowingRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
    // number (optional)
    limit: 56,
    // string (optional)
    cursor: cursor_example,
  } satisfies UsersGetFollowingRequest;

  try {
    const data = await api.usersGetFollowing(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `24`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**PublicProfileListResponse**](PublicProfileListResponse.md)

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


## usersGetLikes

> PublicSavesResponse usersGetLikes(handle, limit, cursor)



The **public** bookmarks this profile has liked, most recently liked first - the Likes tab on &#x60;/u/{handle}&#x60;.  A like on a bookmark that is not public is not listed, whoever owns it. A like is a public act on a public thing; it is not a licence to see somebody\&#39;s private library through the back door.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersGetLikesRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
    // number (optional)
    limit: 56,
    // string (optional)
    cursor: cursor_example,
  } satisfies UsersGetLikesRequest;

  try {
    const data = await api.usersGetLikes(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `24`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**PublicSavesResponse**](PublicSavesResponse.md)

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


## usersGetProfile

> PublicProfile usersGetProfile(handle)



A public profile by handle.  Keyed on the handle rather than the id so a profile link survives being pasted somewhere. 404 - never 403 - when the profile has blocked the caller: a 403 would confirm both that the account exists and that something about the caller is why they cannot see it, which is exactly what a block withholds.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersGetProfileRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
  } satisfies UsersGetProfileRequest;

  try {
    const data = await api.usersGetProfile(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**PublicProfile**](PublicProfile.md)

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


## usersGetSaves

> PublicSavesResponse usersGetSaves(handle, limit, cursor)



A profile\&#39;s public saves, newest first. Never their private ones, and never anything at all to a user they have blocked.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersGetSavesRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
    // number (optional)
    limit: 56,
    // string | Opaque keyset cursor from the previous page. (optional)
    cursor: cursor_example,
  } satisfies UsersGetSavesRequest;

  try {
    const data = await api.usersGetSaves(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `24`] |
| **cursor** | `string` | Opaque keyset cursor from the previous page. | [Optional] [Defaults to `undefined`] |

### Return type

[**PublicSavesResponse**](PublicSavesResponse.md)

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


## usersUnblock

> BlockResponse usersUnblock(handle)



Unblock. Does not restore the follow edges the block removed - those were deleted, and re-following is the user\&#39;s decision to make again.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersUnblockRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
  } satisfies UsersUnblockRequest;

  try {
    const data = await api.usersUnblock(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**BlockResponse**](BlockResponse.md)

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


## usersUnfollow

> FollowResponse usersUnfollow(handle)



Unfollow. Immediate and silent - the followed user is not notified.

### Example

```ts
import {
  Configuration,
  SocialApi,
} from '@cosmic-dolphin/api-client';
import type { UsersUnfollowRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SocialApi(config);

  const body = {
    // string
    handle: handle_example,
  } satisfies UsersUnfollowRequest;

  try {
    const data = await api.usersUnfollow(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**FollowResponse**](FollowResponse.md)

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
| **429** | Client error |  * Retry-After -  <br>  |
| **500** | Server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

