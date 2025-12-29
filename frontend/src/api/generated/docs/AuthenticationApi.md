# AuthenticationApi

All URIs are relative to *https://www.crosswithfriends.com/api*

| Method                                                                           | HTTP request                  | Description                                |
| -------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| [**createToken**](AuthenticationApi.md#createtokenoperation)                     | **POST** /auth/token          | Create authentication token                |
| [**exchangeFirebaseToken**](AuthenticationApi.md#exchangefirebasetokenoperation) | **POST** /auth/firebase-token | Exchange Firebase ID token for backend JWT |
| [**getCurrentUser**](AuthenticationApi.md#getcurrentuser)                        | **GET** /auth/me              | Get current user                           |
| [**validateToken**](AuthenticationApi.md#validatetokenoperation)                 | **POST** /auth/validate       | Validate authentication token              |

## createToken

> CreateToken200Response createToken(createTokenRequest)

Create authentication token

Creates a new JWT authentication token for a user. If userId is not provided, a new secure user ID is generated.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { CreateTokenOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // CreateTokenRequest (optional)
    createTokenRequest: ...,
  } satisfies CreateTokenOperationRequest;

  try {
    const data = await api.createToken(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                   | Type                                        | Description | Notes      |
| ---------------------- | ------------------------------------------- | ----------- | ---------- |
| **createTokenRequest** | [CreateTokenRequest](CreateTokenRequest.md) |             | [Optional] |

### Return type

[**CreateToken200Response**](CreateToken200Response.md)

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

## exchangeFirebaseToken

> ExchangeFirebaseToken200Response exchangeFirebaseToken(exchangeFirebaseTokenRequest)

Exchange Firebase ID token for backend JWT

Verifies a Firebase ID token and returns a backend JWT token. The Firebase UID is used as the userId in the backend JWT.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { ExchangeFirebaseTokenOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // ExchangeFirebaseTokenRequest
    exchangeFirebaseTokenRequest: ...,
  } satisfies ExchangeFirebaseTokenOperationRequest;

  try {
    const data = await api.exchangeFirebaseToken(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                             | Type                                                            | Description | Notes |
| -------------------------------- | --------------------------------------------------------------- | ----------- | ----- |
| **exchangeFirebaseTokenRequest** | [ExchangeFirebaseTokenRequest](ExchangeFirebaseTokenRequest.md) |             |       |

### Return type

[**ExchangeFirebaseToken200Response**](ExchangeFirebaseToken200Response.md)

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
| **401**     | Default Response | -                |
| **503**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## getCurrentUser

> GetCurrentUser200Response getCurrentUser()

Get current user

Returns information about the currently authenticated user based on the Authorization header.

### Example

```ts
import { Configuration, AuthenticationApi } from '';
import type { GetCurrentUserRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const api = new AuthenticationApi();

  try {
    const data = await api.getCurrentUser();
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

[**GetCurrentUser200Response**](GetCurrentUser200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Default Response | -                |
| **401**     | Default Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## validateToken

> ValidateToken200Response validateToken(validateTokenRequest)

Validate authentication token

Validates a JWT token and returns its payload if valid.

### Example

```ts
import {
  Configuration,
  AuthenticationApi,
} from '';
import type { ValidateTokenOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthenticationApi();

  const body = {
    // ValidateTokenRequest
    validateTokenRequest: ...,
  } satisfies ValidateTokenOperationRequest;

  try {
    const data = await api.validateToken(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                     | Type                                            | Description | Notes |
| ------------------------ | ----------------------------------------------- | ----------- | ----- |
| **validateTokenRequest** | [ValidateTokenRequest](ValidateTokenRequest.md) |             |       |

### Return type

[**ValidateToken200Response**](ValidateToken200Response.md)

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
