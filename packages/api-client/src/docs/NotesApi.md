# NotesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**notesCreate**](NotesApi.md#notescreate) | **POST** /notes |  |
| [**notesFindAll**](NotesApi.md#notesfindall) | **GET** /notes |  |
| [**notesFindById**](NotesApi.md#notesfindbyid) | **GET** /notes/{id} |  |



## notesCreate

> Note notesCreate(createNoteRequest)



### Example

```ts
import {
  Configuration,
  NotesApi,
} from '@cosmic-dolphin/api-client';
import type { NotesCreateRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new NotesApi(config);

  const body = {
    // CreateNoteRequest
    createNoteRequest: ...,
  } satisfies NotesCreateRequest;

  try {
    const data = await api.notesCreate(body);
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
| **createNoteRequest** | [CreateNoteRequest](CreateNoteRequest.md) |  | |

### Return type

[**Note**](Note.md)

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The request has succeeded and a new resource has been created as a result. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## notesFindAll

> Array&lt;Note&gt; notesFindAll()



### Example

```ts
import {
  Configuration,
  NotesApi,
} from '@cosmic-dolphin/api-client';
import type { NotesFindAllRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new NotesApi(config);

  try {
    const data = await api.notesFindAll();
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

[**Array&lt;Note&gt;**](Note.md)

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


## notesFindById

> Note notesFindById(id)



### Example

```ts
import {
  Configuration,
  NotesApi,
} from '@cosmic-dolphin/api-client';
import type { NotesFindByIdRequest } from '@cosmic-dolphin/api-client';

async function example() {
  console.log("🚀 Testing @cosmic-dolphin/api-client SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: BearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new NotesApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies NotesFindByIdRequest;

  try {
    const data = await api.notesFindById(body);
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

[**Note**](Note.md)

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

