# FeedApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**feedFeedback**](FeedApi.md#feedfeedbackoperation) | **POST** /feed/feedback |  |
| [**feedRail**](FeedApi.md#feedrail) | **GET** /feed/rail |  |



## feedFeedback

> FeedFeedbackResponse feedFeedback(feedFeedbackRequest)



Tell the ranker it got one wrong — docs/functional-spec/05-feed.md § Feedback.  Reached from each feed item\&#39;s overflow menu. Takes effect on the next request, visibly: a dismissed item that comes back is a bug, not a ranking nuance.

### Example

```ts
import {
  Configuration,
  FeedApi,
} from '@cosmic-dolphin/api-client';
import type { FeedFeedbackOperationRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FeedApi(config);

  const body = {
    // FeedFeedbackRequest
    feedFeedbackRequest: ...,
  } satisfies FeedFeedbackOperationRequest;

  try {
    const data = await api.feedFeedback(body);
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
| **feedFeedbackRequest** | [FeedFeedbackRequest](FeedFeedbackRequest.md) |  | |

### Return type

[**FeedFeedbackResponse**](FeedFeedbackResponse.md)

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


## feedRail

> FeedRailResponse feedRail(topicLimit, peopleLimit)



Home\&#39;s rail: the topics the reader has been saving this week, and the people they follow with their public output for the week.  One request rather than three, because the rail is one column and a column that arrives in three pieces reflows twice.

### Example

```ts
import {
  Configuration,
  FeedApi,
} from '@cosmic-dolphin/api-client';
import type { FeedRailRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FeedApi(config);

  const body = {
    // number | How many topics to return. 6 is what the rail renders. (optional)
    topicLimit: 56,
    // number | How many people to return. 5 is what the rail renders. (optional)
    peopleLimit: 56,
  } satisfies FeedRailRequest;

  try {
    const data = await api.feedRail(body);
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
| **topicLimit** | `number` | How many topics to return. 6 is what the rail renders. | [Optional] [Defaults to `6`] |
| **peopleLimit** | `number` | How many people to return. 5 is what the rail renders. | [Optional] [Defaults to `5`] |

### Return type

[**FeedRailResponse**](FeedRailResponse.md)

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

