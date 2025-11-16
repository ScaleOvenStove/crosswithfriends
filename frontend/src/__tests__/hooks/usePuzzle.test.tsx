import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {usePuzzle} from '../../hooks/usePuzzle';
import {createMockPuzzleStore} from '../mocks/stores';

const mockUsePuzzleStore = vi.fn();

// Mock the puzzle store
vi.mock('../../store/puzzleStore', () => ({
  usePuzzleStore: () => mockUsePuzzleStore(),
}));

describe('usePuzzle', () => {
  let mockStore: ReturnType<typeof createMockPuzzleStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockPuzzleStore();
    mockUsePuzzleStore.mockReturnValue(mockStore);
  });

  it('should return puzzle from store', () => {
    const mockPuzzle = {
      ready: true,
      data: {title: 'Test Puzzle', author: 'Test Author'},
    };
    mockStore.getPuzzle = vi.fn().mockReturnValue(mockPuzzle);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    expect(result.current.puzzle).toBe(mockPuzzle);
  });

  it('should return ready state from puzzle', () => {
    const mockPuzzle = {
      ready: true,
      data: {title: 'Test Puzzle'},
    };
    mockStore.getPuzzle = vi.fn().mockReturnValue(mockPuzzle);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    expect(result.current.ready).toBe(true);
  });

  it('should return data from puzzle', () => {
    const mockPuzzle = {
      ready: true,
      data: {title: 'Test Puzzle', author: 'Test Author'},
    };
    mockStore.getPuzzle = vi.fn().mockReturnValue(mockPuzzle);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    expect(result.current.data).toEqual({title: 'Test Puzzle', author: 'Test Author'});
  });

  it('should call attach when attach is called', () => {
    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    result.current.attach();

    expect(mockStore.attach).toHaveBeenCalledWith('/puzzle/test');
  });

  it('should call detach when detach is called', () => {
    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    result.current.detach();

    expect(mockStore.detach).toHaveBeenCalledWith('/puzzle/test');
  });

  it('should call listGames with default limit', async () => {
    const mockGames = {game1: {title: 'Game 1'}};
    mockStore.listGames = vi.fn().mockResolvedValue(mockGames);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    const games = await result.current.listGames();

    expect(mockStore.listGames).toHaveBeenCalledWith('/puzzle/test', 100);
    expect(games).toBe(mockGames);
  });

  it('should call listGames with custom limit', async () => {
    const mockGames = {game1: {title: 'Game 1'}};
    mockStore.listGames = vi.fn().mockResolvedValue(mockGames);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    await result.current.listGames(50);

    expect(mockStore.listGames).toHaveBeenCalledWith('/puzzle/test', 50);
  });

  it('should call toGame', () => {
    const mockGame = {title: 'Test Game'};
    mockStore.toGame = vi.fn().mockReturnValue(mockGame);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    const game = result.current.toGame();

    expect(mockStore.toGame).toHaveBeenCalledWith('/puzzle/test');
    expect(game).toBe(mockGame);
  });

  it('should call waitForReady', async () => {
    mockStore.waitForReady = vi.fn().mockResolvedValue(undefined);

    const {result} = renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123}));

    await result.current.waitForReady();

    expect(mockStore.waitForReady).toHaveBeenCalledWith('/puzzle/test');
  });

  it('should call onReady when puzzle becomes ready', async () => {
    const mockPuzzle = {
      ready: false,
      data: null,
    };
    mockStore.getPuzzle = vi.fn().mockReturnValue(mockPuzzle);
    const onReady = vi.fn();

    renderHook(() => usePuzzle({path: '/puzzle/test', pid: 123, onReady}));

    // Simulate puzzle becoming ready
    mockPuzzle.ready = true;
    mockPuzzle.data = {title: 'Test Puzzle'};

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });
  });
});
