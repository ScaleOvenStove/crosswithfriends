import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {createNewPuzzle} from '../../../api/puzzle';
import {useCreatePuzzle} from '../../../hooks/api/useCreatePuzzle';

// Mock createNewPuzzle API
vi.mock('../../../api/puzzle', () => ({
  createNewPuzzle: vi.fn(),
}));

describe('useCreatePuzzle', () => {
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

  it('should create mutation with createNewPuzzle function', async () => {
    const mockResponse = {pid: 'test-puzzle-id'};
    (createNewPuzzle as any).mockResolvedValue(mockResponse);

    const {result} = renderHook(() => useCreatePuzzle(), {wrapper});

    const mutationData = {
      puzzle: {title: 'Test Puzzle', author: 'Test Author'},
      pid: '123',
      isPublic: true,
    };
    result.current.mutate(mutationData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(createNewPuzzle).toHaveBeenCalledWith(mutationData.puzzle, '123', {isPublic: true});
  });

  it('should use default isPublic value when not provided', async () => {
    const mockResponse = {pid: 'test-puzzle-id'};
    (createNewPuzzle as any).mockResolvedValue(mockResponse);

    const {result} = renderHook(() => useCreatePuzzle(), {wrapper});

    const mutationData = {
      puzzle: {title: 'Test Puzzle', author: 'Test Author'},
    };
    result.current.mutate(mutationData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(createNewPuzzle).toHaveBeenCalledWith(mutationData.puzzle, undefined, {isPublic: false});
  });

  it('should call onSuccess callback when mutation succeeds', async () => {
    const mockResponse = {pid: 'test-puzzle-id'};
    (createNewPuzzle as any).mockResolvedValue(mockResponse);
    const onSuccess = vi.fn();

    const {result} = renderHook(() => useCreatePuzzle({onSuccess}), {wrapper});

    result.current.mutate({
      puzzle: {title: 'Test Puzzle', author: 'Test Author'},
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      // React Query passes (data, variables, context) to onSuccess
      const calls = onSuccess.mock.calls[0];
      expect(calls[0]).toEqual(mockResponse);
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should call onError callback when mutation fails', async () => {
    const mockError = new Error('Failed to create puzzle');
    (createNewPuzzle as any).mockRejectedValue(mockError);
    const onError = vi.fn();

    const {result} = renderHook(() => useCreatePuzzle({onError}), {wrapper});

    result.current.mutate({
      puzzle: {title: 'Test Puzzle', author: 'Test Author'},
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      // React Query passes (error, variables, context) to onError
      const calls = onError.mock.calls[0];
      expect(calls[0]).toEqual(mockError);
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
