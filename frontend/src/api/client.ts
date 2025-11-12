/**
 * Centralized API Client
 * Provides request/response interceptors, error handling, retry logic, and request cancellation
 */

import {apiConfig} from '../config';

export interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  response?: unknown;
}

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;
export type ErrorInterceptor = (error: ApiError) => ApiError | Promise<ApiError>;

class ApiClient {
  private baseURL: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private defaultRetries = 3;
  private defaultRetryDelay = 1000; // 1 second
  private defaultTimeout = 30000; // 30 seconds

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add an error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.errorInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Build URL with query parameters
   */
  private buildURL(url: string, params?: Record<string, string | number | boolean>): string {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    if (!params || Object.keys(params).length === 0) {
      return fullURL;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const separator = fullURL.includes('?') ? '&' : '?';
    return `${fullURL}${separator}${searchParams.toString()}`;
  }

  /**
   * Create timeout promise
   */
  private createTimeout(timeout: number, signal?: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Request timeout after ${timeout}ms`) as ApiError;
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      }
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: ApiError): boolean {
    // Retry on network errors or 5xx server errors
    if (!error.status) {
      return true; // Network error
    }
    return error.status >= 500 && error.status < 600;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequest(config: RequestConfig, attempt = 0): Promise<Response> {
    // Apply request interceptors
    let processedConfig = config;
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }

    const {
      url,
      method = 'GET',
      headers = {},
      body,
      params,
      signal,
      timeout = this.defaultTimeout,
    } = processedConfig;

    const fullURL = this.buildURL(url, params);

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal,
    };

    if (body !== undefined) {
      if (typeof body === 'string') {
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    try {
      // Create timeout race
      const fetchPromise = fetch(fullURL, fetchOptions);
      const timeoutPromise = this.createTimeout(timeout, signal);
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      // Apply response interceptors
      let processedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      return processedResponse;
    } catch (error) {
      const apiError = error as ApiError;

      // Apply error interceptors
      let processedError = apiError;
      for (const interceptor of this.errorInterceptors) {
        processedError = await interceptor(processedError);
      }

      // Retry logic
      const retries = processedConfig.retries ?? this.defaultRetries;
      const retryDelay = processedConfig.retryDelay ?? this.defaultRetryDelay;

      if (attempt < retries && this.isRetryableError(processedError)) {
        const delay = this.calculateRetryDelay(attempt, retryDelay);
        await this.sleep(delay);
        return this.executeRequest(processedConfig, attempt + 1);
      }

      throw processedError;
    }
  }

  /**
   * Main request method
   */
  async request<T>(config: RequestConfig): Promise<T> {
    try {
      const response = await this.executeRequest(config);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        let errorData: unknown;

        try {
          errorData = JSON.parse(errorText);
          if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
            errorMessage = String((errorData as {message: unknown}).message) || errorMessage;
          }
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        const error = new Error(errorMessage) as ApiError;
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = errorData || errorText;

        // Apply error interceptors
        let processedError = error;
        for (const interceptor of this.errorInterceptors) {
          processedError = await interceptor(processedError);
        }

        throw processedError;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json() as Promise<T>;
      }

      return (await response.text()) as unknown as T;
    } catch (error) {
      // If it's already an ApiError, re-throw it
      if (error instanceof Error && 'status' in error) {
        throw error;
      }

      // Wrap unknown errors
      const apiError = new Error(error instanceof Error ? error.message : 'Unknown error') as ApiError;
      apiError.name = error instanceof Error ? error.name : 'ApiError';
      apiError.response = error;

      // Apply error interceptors
      let processedError = apiError;
      for (const interceptor of this.errorInterceptors) {
        processedError = await interceptor(processedError);
      }

      throw processedError;
    }
  }

  /**
   * Convenience methods
   */
  get<T>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<T> {
    return this.request<T>({...config, url, method: 'GET'});
  }

  post<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({...config, url, method: 'POST', body});
  }

  put<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({...config, url, method: 'PUT', body});
  }

  patch<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({...config, url, method: 'PATCH', body});
  }

  delete<T>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<T> {
    return this.request<T>({...config, url, method: 'DELETE'});
  }
}

// Create singleton instance
export const apiClient = new ApiClient(apiConfig.baseURL);

// Export default instance
export default apiClient;

