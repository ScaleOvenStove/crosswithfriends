# GamesApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method                                               | HTTP request            | Description                    |
| ---------------------------------------------------- | ----------------------- | ------------------------------ |
| [**createGame**](GamesApi.md#creategameoperation)    | **POST** /game          | Create a new game              |
| [**getActiveGamePid**](GamesApi.md#getactivegamepid) | **GET** /game/{gid}/pid | Get puzzle ID from active game |
| [**getGameById**](GamesApi.md#getgamebyid)           | **GET** /game/{gid}     | Get game by ID                 |

## createGame

> CreateGame200Response createGame(createGameRequest)

Create a new game

Creates a new game session for a puzzle

### Example

```ts
import {
  Configuration,
  GamesApi,
} from '';
import type { CreateGameOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new GamesApi();

  const body = {
    // CreateGameRequest
    createGameRequest: ...,
  } satisfies CreateGameOperationRequest;

  try {
    const data = await api.createGame(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                  | Type                                      | Description | Notes |
| --------------------- | ----------------------------------------- | ----------- | ----- |
| **createGameRequest** | [CreateGameRequest](CreateGameRequest.md) |             |       |

### Return type

[**CreateGame200Response**](CreateGame200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |
| **500**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## getActiveGamePid

> GetActiveGamePid200Response getActiveGamePid(gid)

Get puzzle ID from active game

Retrieves the puzzle ID from an active (in-progress) game in game_events table

### Example

```ts
import { Configuration, GamesApi } from '';
import type { GetActiveGamePidRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new GamesApi();

  const body = {
    // string | Game ID
    gid: gid_example,
  } satisfies GetActiveGamePidRequest;

  try {
    const data = await api.getActiveGamePid(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name    | Type     | Description | Notes                     |
| ------- | -------- | ----------- | ------------------------- |
| **gid** | `string` | Game ID     | [Defaults to `undefined`] |

### Return type

[**GetActiveGamePid200Response**](GetActiveGamePid200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |
| **404**     | Default Response | -                |
| **500**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## getGameById

> GetGameById200Response getGameById(gid)

Get game by ID

Retrieves game information including puzzle details and solve time

### Example

```ts
import { Configuration, GamesApi } from '';
import type { GetGameByIdRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new GamesApi();

  const body = {
    // string | Game ID
    gid: gid_example,
  } satisfies GetGameByIdRequest;

  try {
    const data = await api.getGameById(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name    | Type     | Description | Notes                     |
| ------- | -------- | ----------- | ------------------------- |
| **gid** | `string` | Game ID     | [Defaults to `undefined`] |

### Return type

[**GetGameById200Response**](GetGameById200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |
| **404**     | Default Response | -                |
| **500**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
