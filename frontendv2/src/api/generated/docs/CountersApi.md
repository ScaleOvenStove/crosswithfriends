# CountersApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getNewGameId**](CountersApi.md#getnewgameid) | **POST** /counters/gid | Increment and get a new game ID |
| [**getNewPuzzleId**](CountersApi.md#getnewpuzzleid) | **POST** /counters/pid | Increment and get a new puzzle ID |



## getNewGameId

> GetNewGameId200Response getNewGameId()

Increment and get a new game ID

Increments the game ID counter and returns the new game ID

### Example

```ts
import {
  Configuration,
  CountersApi,
} from '';
import type { GetNewGameIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CountersApi();

  try {
    const data = await api.getNewGameId();
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

[**GetNewGameId200Response**](GetNewGameId200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **500** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getNewPuzzleId

> GetNewPuzzleId200Response getNewPuzzleId()

Increment and get a new puzzle ID

Increments the puzzle ID counter and returns the new puzzle ID

### Example

```ts
import {
  Configuration,
  CountersApi,
} from '';
import type { GetNewPuzzleIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CountersApi();

  try {
    const data = await api.getNewPuzzleId();
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

[**GetNewPuzzleId200Response**](GetNewPuzzleId200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **500** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

