# LinkPreviewApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getLinkPreview**](LinkPreviewApi.md#getlinkpreview) | **GET** /link_preview/ | Get link preview |
| [**getOembed**](LinkPreviewApi.md#getoembed) | **GET** /oembed | Get oEmbed data |



## getLinkPreview

> string getLinkPreview(url)

Get link preview

Generates Open Graph metadata for social media link previews

### Example

```ts
import {
  Configuration,
  LinkPreviewApi,
} from '';
import type { GetLinkPreviewRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LinkPreviewApi();

  const body = {
    // string | URL to generate preview for
    url: url_example,
  } satisfies GetLinkPreviewRequest;

  try {
    const data = await api.getLinkPreview(body);
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
| **url** | `string` | URL to generate preview for | [Defaults to `undefined`] |

### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | HTML with Open Graph metadata |  -  |
| **302** | Redirect for non-bot user agents |  -  |
| **400** | Default Response |  -  |
| **404** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getOembed

> GetOembed200Response getOembed(author)

Get oEmbed data

Returns oEmbed format metadata for link previews

### Example

```ts
import {
  Configuration,
  LinkPreviewApi,
} from '';
import type { GetOembedRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LinkPreviewApi();

  const body = {
    // string | Author name
    author: author_example,
  } satisfies GetOembedRequest;

  try {
    const data = await api.getOembed(body);
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
| **author** | `string` | Author name | [Defaults to `undefined`] |

### Return type

[**GetOembed200Response**](GetOembed200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

