# StatsApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method                                              | HTTP request    | Description           |
| --------------------------------------------------- | --------------- | --------------------- |
| [**submitStats**](StatsApi.md#submitstatsoperation) | **POST** /stats | Get puzzle statistics |

## submitStats

> SubmitStats200Response submitStats(submitStatsRequest)

Get puzzle statistics

Retrieves aggregated statistics and history for given game IDs

### Example

```ts
import {
  Configuration,
  StatsApi,
} from '';
import type { SubmitStatsOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new StatsApi();

  const body = {
    // SubmitStatsRequest
    submitStatsRequest: ...,
  } satisfies SubmitStatsOperationRequest;

  try {
    const data = await api.submitStats(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                   | Type                                        | Description | Notes |
| ---------------------- | ------------------------------------------- | ----------- | ----- |
| **submitStatsRequest** | [SubmitStatsRequest](SubmitStatsRequest.md) |             |       |

### Return type

[**SubmitStats200Response**](SubmitStats200Response.md)

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
