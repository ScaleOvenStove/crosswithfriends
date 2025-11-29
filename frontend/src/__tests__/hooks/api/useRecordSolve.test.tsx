import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {recordSolve} from '../../../api/puzzle';
import {useRecordSolve} from '../../../hooks/api/useRecordSolve';

// Mock recordSolve API
vi.mock('../../../api/puzzle', () => ({
  recordSolve: vi.fn(),
}));

describe('useRecordSolve', () => {
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

  it('should create mutation with recordSolve function', async () => {
    vi.mocked(recordSolve).mockResolvedValue(undefined);

    const {result} = renderHook(() => useRecordSolve(), {wrapper});

    const mutationData = {pid: '123', gid: 'game-456', time_to_solve: 1000};
    result.current.mutate(mutationData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(recordSolve).toHaveBeenCalledWith('123', 'game-456', 1000);
  });

  it('should call onSuccess callback when mutation succeeds', async () => {
    vi.mocked(recordSolve).mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const {result} = renderHook(() => useRecordSolve({onSuccess}), {wrapper});

    result.current.mutate({pid: '123', gid: 'game-456', time_to_solve: 1000});

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should call onError callback when mutation fails', async () => {
    const mockError = new Error('Failed to record solve');
    vi.mocked(recordSolve).mockRejectedValue(mockError);
    const onError = vi.fn();

    const {result} = renderHook(() => useRecordSolve({onError}), {wrapper});

    result.current.mutate({pid: '123', gid: 'game-456', time_to_solve: 1000});

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      // React Query passes (error, variables, context) to onError
      const calls = onError.mock.calls[0];
      expect(calls[0]).toEqual(mockError);
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
