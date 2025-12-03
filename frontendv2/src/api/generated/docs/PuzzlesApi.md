# PuzzlesApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method                                                            | HTTP request                 | Description         |
| ----------------------------------------------------------------- | ---------------------------- | ------------------- |
| [**createPuzzle**](PuzzlesApi.md#createpuzzleoperation)           | **POST** /puzzle             | Add a new puzzle    |
| [**getPuzzleById**](PuzzlesApi.md#getpuzzlebyid)                  | **GET** /puzzle/{pid}        | Get puzzle by ID    |
| [**listPuzzles**](PuzzlesApi.md#listpuzzles)                      | **GET** /puzzle_list         | List puzzles        |
| [**recordPuzzleSolve**](PuzzlesApi.md#recordpuzzlesolveoperation) | **POST** /record_solve/{pid} | Record puzzle solve |

## createPuzzle

> CreatePuzzle200Response createPuzzle(createPuzzleRequest)

Add a new puzzle

Adds a new puzzle to the system. If pid is not provided, the backend generates one.

### Example

```ts
import {
  Configuration,
  PuzzlesApi,
} from '';
import type { CreatePuzzleOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PuzzlesApi();

  const body = {
    // CreatePuzzleRequest
    createPuzzleRequest: ...,
  } satisfies CreatePuzzleOperationRequest;

  try {
    const data = await api.createPuzzle(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                    | Type                                          | Description | Notes |
| ----------------------- | --------------------------------------------- | ----------- | ----- |
| **createPuzzleRequest** | [CreatePuzzleRequest](CreatePuzzleRequest.md) |             |       |

### Return type

[**CreatePuzzle200Response**](CreatePuzzle200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |
| **400**     | Default Response | -                |
| **500**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## getPuzzleById

> CreatePuzzleRequestPuzzle getPuzzleById(pid)

Get puzzle by ID

Retrieves full puzzle data including grid, clues, and solution

### Example

```ts
import { Configuration, PuzzlesApi } from '';
import type { GetPuzzleByIdRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new PuzzlesApi();

  const body = {
    // string | Puzzle ID
    pid: pid_example,
  } satisfies GetPuzzleByIdRequest;

  try {
    const data = await api.getPuzzleById(body);
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
| **pid** | `string` | Puzzle ID   | [Defaults to `undefined`] |

### Return type

[**CreatePuzzleRequestPuzzle**](CreatePuzzleRequestPuzzle.md)

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

## listPuzzles

> ListPuzzles200Response listPuzzles(page, pageSize, sizeMini, sizeStandard, nameOrTitle)

List puzzles

Get a paginated list of puzzles with optional filters

### Example

```ts
import { Configuration, PuzzlesApi } from '';
import type { ListPuzzlesRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new PuzzlesApi();

  const body = {
    // string | Page number
    page: page_example,
    // string | Number of items per page
    pageSize: pageSize_example,
    // string | Filter for mini puzzles (true/false) (optional)
    sizeMini: sizeMini_example,
    // string | Filter for standard puzzles (true/false) (optional)
    sizeStandard: sizeStandard_example,
    // string | Filter by name or title (optional)
    nameOrTitle: nameOrTitle_example,
  } satisfies ListPuzzlesRequest;

  try {
    const data = await api.listPuzzles(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name             | Type     | Description                              | Notes                                |
| ---------------- | -------- | ---------------------------------------- | ------------------------------------ |
| **page**         | `string` | Page number                              | [Defaults to `undefined`]            |
| **pageSize**     | `string` | Number of items per page                 | [Defaults to `undefined`]            |
| **sizeMini**     | `string` | Filter for mini puzzles (true/false)     | [Optional] [Defaults to `undefined`] |
| **sizeStandard** | `string` | Filter for standard puzzles (true/false) | [Optional] [Defaults to `undefined`] |
| **nameOrTitle**  | `string` | Filter by name or title                  | [Optional] [Defaults to `undefined`] |

### Return type

[**ListPuzzles200Response**](ListPuzzles200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |
| **400**     | Default Response | -                |
| **500**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## recordPuzzleSolve

> object recordPuzzleSolve(pid, recordPuzzleSolveRequest)

Record puzzle solve

Records a completed puzzle solve with timing information

### Example

```ts
import {
  Configuration,
  PuzzlesApi,
} from '';
import type { RecordPuzzleSolveOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PuzzlesApi();

  const body = {
    // string | Puzzle ID
    pid: pid_example,
    // RecordPuzzleSolveRequest
    recordPuzzleSolveRequest: ...,
  } satisfies RecordPuzzleSolveOperationRequest;

  try {
    const data = await api.recordPuzzleSolve(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                         | Type                                                    | Description | Notes                     |
| ---------------------------- | ------------------------------------------------------- | ----------- | ------------------------- |
| **pid**                      | `string`                                                | Puzzle ID   | [Defaults to `undefined`] |
| **recordPuzzleSolveRequest** | [RecordPuzzleSolveRequest](RecordPuzzleSolveRequest.md) |             |                           |

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description           | Response headers |
| ----------- | --------------------- | ---------------- |
| **200**     | Empty response object | -                |
| **500**     | Default Response      | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
