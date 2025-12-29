# DefaultApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method                                                     | HTTP request                 | Description |
| ---------------------------------------------------------- | ---------------------------- | ----------- |
| [**gameGidGet**](DefaultApi.md#gamegidget)                 | **GET** /game/{gid}          |             |
| [**gamePost**](DefaultApi.md#gamepost)                     | **POST** /game/              |             |
| [**linkPreviewGet**](DefaultApi.md#linkpreviewget)         | **GET** /link_preview/       |             |
| [**oembedGet**](DefaultApi.md#oembedget)                   | **GET** /oembed/             |             |
| [**puzzleListGet**](DefaultApi.md#puzzlelistget)           | **GET** /puzzle_list/        |             |
| [**recordSolvePidPost**](DefaultApi.md#recordsolvepidpost) | **POST** /record_solve/{pid} |             |
| [**statsPost**](DefaultApi.md#statspost)                   | **POST** /stats/             |             |

## gameGidGet

> gameGidGet(gid)

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { GameGidGetRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  const body = {
    // string
    gid: gid_example,
  } satisfies GameGidGetRequest;

  try {
    const data = await api.gameGidGet(body);
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
| **gid** | `string` |             | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## gamePost

> gamePost()

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { GamePostRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  try {
    const data = await api.gamePost();
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

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## linkPreviewGet

> linkPreviewGet()

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { LinkPreviewGetRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  try {
    const data = await api.linkPreviewGet();
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

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## oembedGet

> oembedGet()

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { OembedGetRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  try {
    const data = await api.oembedGet();
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

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## puzzleListGet

> puzzleListGet()

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { PuzzleListGetRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  try {
    const data = await api.puzzleListGet();
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

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## recordSolvePidPost

> recordSolvePidPost(pid)

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { RecordSolvePidPostRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  const body = {
    // string
    pid: pid_example,
  } satisfies RecordSolvePidPostRequest;

  try {
    const data = await api.recordSolvePidPost(body);
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
| **pid** | `string` |             | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## statsPost

> statsPost()

### Example

```ts
import { Configuration, DefaultApi } from '';
import type { StatsPostRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new DefaultApi();

  try {
    const data = await api.statsPost();
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

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
