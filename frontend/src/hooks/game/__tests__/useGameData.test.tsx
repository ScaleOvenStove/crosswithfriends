/**
 * Unit tests for useGameData hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameData } from '../useGameData';
import { puzzlesApi, gamesApi } from '@api/apiClient';
import type { PuzzleJson } from '@schemas/puzzleSchemas';

// Mock API clients
vi.mock('@api/apiClient', () => {
  // Define MockResponseError inside the factory to avoid hoisting issues
  class MockResponseError extends Error {
    override name = 'ResponseError';
    constructor(
      public response: Response,
      msg?: string
    ) {
      super(msg);
    }
  }

  return {
    puzzlesApi: {
      getPuzzleById: vi.fn(),
    },
    gamesApi: {
      getGameById: vi.fn(),
    },
    ResponseError: MockResponseError,
  };
});

// Mock puzzle utils
vi.mock('@utils/puzzleUtils', () => ({
  transformPuzzleToGrid: vi.fn(() => ({
    cells: [[{ value: '', isBlack: false, isPencil: false }]],
    solution: [['A']],
    circles: [],
    shades: [],
  })),
  assignCellNumbers: vi.fn((cells) => cells),
  extractCluesFromPuzzle: vi.fn(() => ({
    across: [],
    down: [],
  })),
}));

// Mock store
vi.mock('@stores/gameStore', () => ({
  useGameStore: vi.fn(() => ({
    setPuzzleId: vi.fn(),
    setCells: vi.fn(),
    setSolution: vi.fn(),
    setClues: vi.fn(),
  })),
}));

describe('useGameData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should load puzzle data successfully', async () => {
    const mockPuzzleData: PuzzleJson = {
      version: 'http://ipuz.org/v2',
      kind: ['http://ipuz.org/crossword#1'],
      dimensions: { width: 15, height: 15 },
      title: 'Test Puzzle',
      author: 'Test Author',
      solution: [['A']],
      puzzle: [[1]],
      clues: { Across: [], Down: [] },
    };

    // Mock fetch for active game check (used in resolvePuzzleId)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response));

    vi.mocked(puzzlesApi.getPuzzleById).mockResolvedValue(mockPuzzleData as unknown as Awaited<ReturnType<typeof puzzlesApi.getPuzzleById>>);
    vi.mocked(gamesApi.getGameById).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useGameData('test-game-id'), { wrapper });

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(result.current.loadError).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    // Mock fetch for active game check (used in resolvePuzzleId)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response));

    vi.mocked(puzzlesApi.getPuzzleById).mockRejectedValue(new Error('Failed to load'));
    vi.mocked(gamesApi.getGameById).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useGameData('test-game-id'), { wrapper });

    await waitFor(
      () => {
        expect(result.current.hasLoaded).toBe(true);
      },
      { timeout: 3000 }
    );

    expect(result.current.loadError).not.toBeNull();
  });
});
