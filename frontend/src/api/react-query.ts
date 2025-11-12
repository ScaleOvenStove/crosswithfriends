/**
 * React Query setup and configuration
 * Provides QueryClient with default options and custom query hooks
 */

import {QueryClient} from '@tanstack/react-query';

// Create query client instance with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Export query keys factory for type-safe query keys
export const queryKeys = {
  games: {
    all: ['games'] as const,
    detail: (gid: string) => ['games', gid] as const,
  },
  puzzles: {
    all: ['puzzles'] as const,
    list: (params: unknown) => ['puzzles', 'list', params] as const,
    detail: (pid: string) => ['puzzles', pid] as const,
  },
  stats: {
    all: ['stats'] as const,
    list: (params: unknown) => ['stats', 'list', params] as const,
  },
  counters: {
    all: ['counters'] as const,
    gid: ['counters', 'gid'] as const,
    pid: ['counters', 'pid'] as const,
  },
} as const;

