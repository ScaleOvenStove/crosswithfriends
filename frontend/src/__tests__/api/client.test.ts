import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {apiClient, type RequestConfig, type ApiError} from '../../api/client';

// Mock fetch
globalThis.fetch = vi.fn() as typeof fetch;

// Mock config
vi.mock('../../config', () => ({
  apiConfig: {
    baseURL: 'http://localhost:3000',
  },
}));

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalThis.fetch).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request interceptors', () => {
    it('should apply request interceptors', async () => {
      const interceptor = vi.fn((config: RequestConfig) => ({
        ...config,
        headers: {...config.headers, 'X-Custom': 'value'},
      }));

      apiClient.addRequestInterceptor(interceptor);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      } as Response);

      await apiClient.get('/test');

      expect(interceptor).toHaveBeenCalled();
    });

    it('should allow removing request interceptors', async () => {
      const interceptor = vi.fn();
      const remove = apiClient.addRequestInterceptor(interceptor);

      remove();

      // Verify interceptor was removed by checking it's not called on next request
      const interceptor2 = vi.fn((config: RequestConfig) => config);
      apiClient.addRequestInterceptor(interceptor2);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      } as Response);

      await apiClient.get('/test');

      expect(interceptor).not.toHaveBeenCalled();
      expect(interceptor2).toHaveBeenCalled();
    });
  });

  describe('response interceptors', () => {
    it('should apply response interceptors', async () => {
      const interceptor = vi.fn((response: Response) => response);
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      } as Response;

      apiClient.addResponseInterceptor(interceptor);
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await apiClient.get('/test');

      expect(interceptor).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('error interceptors', () => {
    it('should apply error interceptors on error', async () => {
      const interceptor = vi.fn((error: ApiError) => error);
      const mockError = new Error('Test error') as ApiError;

      apiClient.addErrorInterceptor(interceptor);
      vi.mocked(globalThis.fetch).mockRejectedValue(mockError);

      try {
        await apiClient.get('/test', {retries: 0, timeout: 1000});
      } catch (_error) {
        // Expected - error should be caught
      }

      expect(interceptor).toHaveBeenCalled();
    });
  });

  describe('GET requests', () => {
    it('should make GET request', async () => {
      const mockData = {id: 1, name: 'Test'};
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => mockData,
      } as Response);

      const result = await apiClient.get('/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should include query parameters in URL', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      } as Response);

      await apiClient.get('/test', {params: {page: 1, limit: 10}});

      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.any(Object));
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
    });
  });

  describe('POST requests', () => {
    it('should make POST request with body', async () => {
      const mockData = {id: 1};
      const requestData = {name: 'Test'};
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => mockData,
      } as Response);

      const result = await apiClient.post('/test', requestData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('retry logic', () => {
    it('should retry on network errors', async () => {
      let attempt = 0;
      vi.mocked(globalThis.fetch).mockImplementation(() => {
        attempt += 1;
        if (attempt < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn(() => 'application/json'),
          },
          json: async () => ({}),
        } as Response);
      });

      await apiClient.get('/test', {retries: 3});

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      let attempt = 0;
      vi.mocked(globalThis.fetch).mockImplementation(() => {
        attempt += 1;
        if (attempt < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            headers: {
              get: vi.fn(),
            },
            text: async () => '{}',
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn(() => 'application/json'),
          },
          json: async () => ({}),
        } as Response);
      });

      try {
        await apiClient.get('/test', {retries: 3, timeout: 1000});
      } catch (_error) {
        // May throw on 5xx, but should retry first
      }

      // Should retry at least once (attempt < 2 means it fails first time)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: vi.fn(),
        },
        text: async () => JSON.stringify({error: 'Bad Request'}),
      } as Response);

      try {
        await apiClient.get('/test', {retries: 3});
      } catch (error) {
        expect((error as ApiError).status).toBe(400);
      }

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout', () => {
    it('should timeout after specified duration', async () => {
      vi.useFakeTimers();

      vi.mocked(globalThis.fetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            // Use fake timers setTimeout
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                headers: {get: vi.fn(() => 'application/json')},
                json: async () => ({}),
              } as Response);
            }, 10000);
          })
      );

      // Create the request promise
      const requestPromise = apiClient.get('/test', {timeout: 1000, retries: 0});

      // Suppress unhandled rejection warnings for this test
      // The rejection is handled by expect().rejects but timing with fake timers causes warnings
      requestPromise.catch(() => {});

      // Advance timers to trigger timeout
      await vi.advanceTimersByTimeAsync(1000);

      // The request should reject with timeout error
      await expect(requestPromise).rejects.toThrow('Request timeout after 1000ms');

      vi.useRealTimers();
    });
  });

  describe('request cancellation', () => {
    it('should cancel request when AbortSignal is triggered', async () => {
      const abortController = new AbortController();
      let abortListener: (() => void) | null = null;

      vi.mocked(globalThis.fetch).mockImplementation(
        (_url: string | URL | Request, options?: RequestInit) =>
          new Promise((resolve, reject) => {
            // Simulate fetch respecting AbortSignal
            if (options?.signal) {
              abortListener = () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              };
              options.signal.addEventListener('abort', abortListener);
            }
            // Never resolves naturally
            setTimeout(() => resolve({ok: true, status: 200} as Response), 10000);
          })
      );

      const promise = apiClient.get('/test', {signal: abortController.signal, timeout: 10000, retries: 0});

      // Wait a tick for the promise to set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Abort immediately
      abortController.abort();

      await expect(promise).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw ApiError with status code', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: vi.fn(),
        },
        text: async () => JSON.stringify({error: 'Not Found'}),
      } as Response);

      try {
        await apiClient.get('/test');
      } catch (error) {
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).statusText).toBe('Not Found');
      }
    });
  });
});
