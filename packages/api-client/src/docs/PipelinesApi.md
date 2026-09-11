# PipelinesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**pipelinesFindByRefId**](PipelinesApi.md#pipelinesfindbyrefid) | **GET** /pipelines/{refId} |  |



## pipelinesFindByRefId

> Array&lt;Pipeline&gt; pipelinesFindByRefId(refId)



### Example

```ts
import {
  Configuration,
  PipelinesApi,
} from '@cosmic-dolphin/api-client';
import type { PipelinesFindByRefIdRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PipelinesApi(config);

  const body = {
    // number
    refId: 56,
  } satisfies PipelinesFindByRefIdRequest;

  try {
    const data = await api.pipelinesFindByRefId(body);
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
| **refId** | `number` |  | [Defaults to `undefined`] |

### Return type

[**Array&lt;Pipeline&gt;**](Pipeline.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The request has succeeded. |  -  |
| **0** | An unexpected error response. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

