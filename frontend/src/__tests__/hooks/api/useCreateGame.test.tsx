import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {createGame} from '../../../api/create_game';
import {useCreateGame} from '../../../hooks/api/useCreateGame';

// Mock createGame API
vi.mock('../../../api/create_game', () => ({
  createGame: vi.fn(),
}));

describe('useCreateGame', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    });
  });

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should create mutation with createGame function', async () => {
    const mockResponse = {gid: 'test-game-id'};
    vi.mocked(createGame).mockResolvedValue(mockResponse);

    const {result} = renderHook(() => useCreateGame(), {wrapper});

    const mutationData = {pid: '123', title: 'Test Game'};
    result.current.mutate(mutationData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(createGame).toHaveBeenCalledWith(mutationData);
  });

  it('should call onSuccess callback when mutation succeeds', async () => {
    const mockResponse = {gid: 'test-game-id'};
    vi.mocked(createGame).mockResolvedValue(mockResponse);
    const onSuccess = vi.fn();

    const {result} = renderHook(() => useCreateGame({onSuccess}), {wrapper});

    result.current.mutate({pid: '123', title: 'Test Game'});

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      // React Query passes (data, variables, context) to onSuccess
      const calls = onSuccess.mock.calls[0];
      expect(calls[0]).toEqual(mockResponse);
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should call onError callback when mutation fails', async () => {
    const mockError = new Error('Failed to create game');
    vi.mocked(createGame).mockRejectedValue(mockError);
    const onError = vi.fn();

    const {result} = renderHook(() => useCreateGame({onError}), {wrapper});

    result.current.mutate({pid: '123', title: 'Test Game'});

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      // React Query passes (error, variables, context) to onError
      const calls = onError.mock.calls[0];
      expect(calls[0]).toEqual(mockError);
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
