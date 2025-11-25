import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {apiClient, type RequestConfig, type ApiError} from '../../api/client';

// Mock fetch
global.fetch = vi.fn();

// Mock config
vi.mock('../../config', () => ({
  apiConfig: {
    baseURL: 'http://localhost:3000',
  },
}));

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
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
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      });

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
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      });

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
      (global.fetch as any).mockResolvedValue(mockResponse);

      await apiClient.get('/test');

      expect(interceptor).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('error interceptors', () => {
    it('should apply error interceptors on error', async () => {
      const interceptor = vi.fn((error: ApiError) => error);
      const mockError = new Error('Test error') as ApiError;

      apiClient.addErrorInterceptor(interceptor);
      (global.fetch as any).mockRejectedValue(mockError);

      try {
        await apiClient.get('/test', {retries: 0, timeout: 1000});
      } catch (error) {
        // Expected - error should be caught
      }

      expect(interceptor).toHaveBeenCalled();
    });
  });

  describe('GET requests', () => {
    it('should make GET request', async () => {
      const mockData = {id: 1, name: 'Test'};
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => mockData,
      });

      const result = await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should include query parameters in URL', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => ({}),
      });

      await apiClient.get('/test', {params: {page: 1, limit: 10}});

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
    });
  });

  describe('POST requests', () => {
    it('should make POST request with body', async () => {
      const mockData = {id: 1};
      const requestData = {name: 'Test'};
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'application/json'),
        },
        json: async () => mockData,
      });

      const result = await apiClient.post('/test', requestData);

      expect(global.fetch).toHaveBeenCalledWith(
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
      (global.fetch as any).mockImplementation(() => {
        attempt++;
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
        });
      });

      await apiClient.get('/test', {retries: 3});

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      let attempt = 0;
      (global.fetch as any).mockImplementation(() => {
        attempt++;
        if (attempt < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            headers: {
              get: vi.fn(),
            },
            text: async () => '{}',
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn(() => 'application/json'),
          },
          json: async () => ({}),
        });
      });

      try {
        await apiClient.get('/test', {retries: 3, timeout: 1000});
      } catch (error) {
        // May throw on 5xx, but should retry first
      }

      // Should retry at least once (attempt < 2 means it fails first time)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: vi.fn(),
        },
        text: async () => JSON.stringify({error: 'Bad Request'}),
      });

      try {
        await apiClient.get('/test', {retries: 3});
      } catch (error) {
        expect((error as ApiError).status).toBe(400);
      }

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout', () => {
    it('should timeout after specified duration', async () => {
      vi.useFakeTimers();
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            // Use fake timers setTimeout
            setTimeout(resolve, 10000);
          })
      );

      const promise = apiClient.get('/test', {timeout: 1000, retries: 0});

      // Advance timers to trigger timeout
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow();

      vi.useRealTimers();
    });
  });

  describe('request cancellation', () => {
    it('should cancel request when AbortSignal is triggered', async () => {
      const abortController = new AbortController();
      (global.fetch as any).mockImplementation(
        (_url: string, options: RequestInit) =>
          new Promise((resolve, reject) => {
            // Simulate fetch respecting AbortSignal
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              });
            }
            // Never resolves naturally
            setTimeout(resolve, 10000);
          })
      );

      const promise = apiClient.get('/test', {signal: abortController.signal, timeout: 5000, retries: 0});

      // Abort immediately
      abortController.abort();

      await expect(promise).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw ApiError with status code', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: vi.fn(),
        },
        text: async () => JSON.stringify({error: 'Not Found'}),
      });

      try {
        await apiClient.get('/test');
      } catch (error) {
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).statusText).toBe('Not Found');
      }
    });
  });
});
