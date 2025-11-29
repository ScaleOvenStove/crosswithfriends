import {ref, onValue, get, set, query, orderByChild, equalTo, limitToLast} from 'firebase/database';
import {describe, it, expect, beforeEach, vi} from 'vitest';

import {usePuzzleStore} from '../../store/puzzleStore';

// Mock Firebase
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  equalTo: vi.fn(),
  limitToLast: vi.fn(),
}));

// Mock firebase store
vi.mock('../../store/firebase', () => ({
  db: {},
  SERVER_TIME: {'.sv': 'timestamp'},
}));

describe('puzzleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    usePuzzleStore.setState({puzzles: {}});
  });

  describe('getPuzzle', () => {
    it('should create a new puzzle instance if it does not exist', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);

      const puzzle = usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);

      expect(ref).toHaveBeenCalledWith({}, '/puzzle/123');
      expect(puzzle).toBeDefined();
      expect(puzzle.path).toBe('/puzzle/123');
      expect(puzzle.pid).toBe(123);
      expect(puzzle.data).toBeNull();
      expect(puzzle.ready).toBe(false);
    });

    it('should return existing puzzle instance if it exists', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);

      const puzzle1 = usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      const puzzle2 = usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);

      expect(puzzle1).toBe(puzzle2);
    });
  });

  describe('attach', () => {
    it('should subscribe to puzzle data', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);
      const mockUnsubscribe = vi.fn();
      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        // Simulate snapshot
        callback({val: () => ({title: 'Test Puzzle'})});
        return mockUnsubscribe;
      });

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.getState().attach('/puzzle/123');

      expect(onValue).toHaveBeenCalled();
      const state = usePuzzleStore.getState();
      expect(state.puzzles['/puzzle/123'].ready).toBe(true);
      expect(state.puzzles['/puzzle/123'].data).toEqual({title: 'Test Puzzle'});
    });

    it('should not attach if puzzle does not exist', () => {
      usePuzzleStore.getState().attach('/puzzle/nonexistent');

      expect(onValue).not.toHaveBeenCalled();
    });

    it('should not attach if already attached', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);
      const mockUnsubscribe = vi.fn();
      vi.mocked(onValue).mockReturnValue(mockUnsubscribe);

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.getState().attach('/puzzle/123');

      // Clear the mock call count
      vi.clearAllMocks();

      // Try to attach again - should not call onValue since already attached
      usePuzzleStore.getState().attach('/puzzle/123');

      expect(onValue).not.toHaveBeenCalled();
    });
  });

  describe('detach', () => {
    it('should unsubscribe from puzzle data', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);
      const mockUnsubscribe = vi.fn();
      let onValueCallCount = 0;
      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        onValueCallCount += 1;
        // Simulate snapshot callback
        callback({val: () => ({title: 'Test Puzzle'})});
        return mockUnsubscribe;
      });

      // Ensure puzzle is detached first
      usePuzzleStore.getState().detach('/puzzle/123');

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.getState().attach('/puzzle/123');

      // Verify attach was called
      expect(onValueCallCount).toBe(1);
      expect(onValue).toHaveBeenCalled();

      // Detach should call the unsubscribe function
      usePuzzleStore.getState().detach('/puzzle/123');

      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();

      // Verify we can attach again after detach
      usePuzzleStore.getState().attach('/puzzle/123');
      expect(onValueCallCount).toBe(2);
    });

    it('should handle detaching non-existent puzzle gracefully', () => {
      expect(() => {
        usePuzzleStore.getState().detach('/puzzle/nonexistent');
      }).not.toThrow();
    });
  });

  describe('waitForReady', () => {
    it('should resolve immediately if puzzle is ready', async () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);

      // Ensure puzzle is detached first
      usePuzzleStore.getState().detach('/puzzle/123');

      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        // Call callback immediately to set puzzle as ready
        callback({val: () => ({title: 'Test'})});
        return vi.fn();
      });

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.getState().attach('/puzzle/123');

      // Wait a bit for state to update
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Now puzzle should be ready
      await expect(usePuzzleStore.getState().waitForReady('/puzzle/123', 100)).resolves.toBeUndefined();
    });

    it('should wait for puzzle to become ready', async () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);
      let _snapshotCallback: ((snapshot: unknown) => void) | null = null;
      vi.mocked(onValue).mockImplementation((_ref, cb) => {
        _snapshotCallback = cb;
        return vi.fn();
      });

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.getState().attach('/puzzle/123');

      // Puzzle is not ready yet
      usePuzzleStore.setState({
        puzzles: {
          '/puzzle/123': {
            ref: mockRefValue,
            path: '/puzzle/123',
            pid: 123,
            data: null,
            ready: false,
          },
        },
      });

      const waitPromise = usePuzzleStore.getState().waitForReady('/puzzle/123', 1000);

      // Make puzzle ready
      setTimeout(() => {
        usePuzzleStore.setState({
          puzzles: {
            '/puzzle/123': {
              ref: mockRefValue,
              path: '/puzzle/123',
              pid: 123,
              data: {title: 'Test'},
              ready: true,
            },
          },
        });
      }, 100);

      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should timeout if puzzle does not become ready', async () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.setState({
        puzzles: {
          '/puzzle/123': {
            ref: mockRefValue,
            path: '/puzzle/123',
            pid: 123,
            data: null,
            ready: false,
          },
        },
      });

      await expect(usePuzzleStore.getState().waitForReady('/puzzle/123', 100)).rejects.toThrow(
        'waitForReady timed out'
      );
    });
  });

  describe('logSolve', () => {
    it('should log solve stats', async () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      const mockStatsRef = {path: '/stats/123', key: '123'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/puzzle/123') return mockRefValue;
        if (path === '/stats/123') return mockStatsRef;
        if (path === '/stats/123/solves/gid-1') return {path: '/stats/123/solves/gid-1'};
        if (path === '/puzzlelist/123') return {path: '/puzzlelist/123'};
        return {path};
      });
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          solves: {
            'gid-1': {time: 100},
            'gid-2': {time: 200},
          },
        }),
      });
      vi.mocked(set).mockResolvedValue(undefined);

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.getState().logSolve('/puzzle/123', 'gid-1', {time: 100, correct: true});

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(set).toHaveBeenCalled();
    });

    it('should not log solve if puzzle does not exist', () => {
      usePuzzleStore.getState().logSolve('/puzzle/nonexistent', 'gid-1', {time: 100, correct: true});

      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('toGame', () => {
    it('should convert puzzle data to game format', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);

      const puzzleData = {
        solution: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        puzzle: [
          [1, 2],
          [null, null],
        ],
        clues: {
          across: [
            [1, 'Clue 1'],
            [2, 'Clue 2'],
          ],
          down: [
            [1, 'Clue 3'],
            [2, 'Clue 4'],
          ],
        },
        title: 'Test Puzzle',
        author: 'Test Author',
      };

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.setState({
        puzzles: {
          '/puzzle/123': {
            ref: mockRefValue,
            path: '/puzzle/123',
            pid: 123,
            data: puzzleData,
            ready: true,
          },
        },
      });

      const game = usePuzzleStore.getState().toGame('/puzzle/123');

      expect(game).toBeDefined();
      expect(game?.info.title).toBe('Test Puzzle');
      expect(game?.info.author).toBe('Test Author');
      expect(game?.solution).toBeDefined();
      expect(game?.grid).toBeDefined();
    });

    it('should return null if puzzle does not exist', () => {
      const game = usePuzzleStore.getState().toGame('/puzzle/nonexistent');
      expect(game).toBeNull();
    });

    it('should return null if puzzle data is null', () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      usePuzzleStore.setState({
        puzzles: {
          '/puzzle/123': {
            ref: mockRefValue,
            path: '/puzzle/123',
            pid: 123,
            data: null,
            ready: false,
          },
        },
      });

      const game = usePuzzleStore.getState().toGame('/puzzle/123');
      expect(game).toBeNull();
    });
  });

  describe('listGames', () => {
    it('should list games for a puzzle', async () => {
      const mockRefValue = {path: '/puzzle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRefValue);
      const mockQuery = {path: '/game'};
      vi.mocked(query).mockReturnValue(mockQuery);
      vi.mocked(orderByChild).mockReturnValue(mockQuery);
      vi.mocked(equalTo).mockReturnValue(mockQuery);
      vi.mocked(limitToLast).mockReturnValue(mockQuery);
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          'game-1': {pid: 123, title: 'Game 1'},
          'game-2': {pid: 123, title: 'Game 2'},
        }),
      });

      usePuzzleStore.getState().getPuzzle('/puzzle/123', 123);
      const games = await usePuzzleStore.getState().listGames('/puzzle/123');

      expect(games).toBeDefined();
      expect(games?.['game-1']).toBeDefined();
      expect(games?.['game-2']).toBeDefined();
    });

    it('should return null if puzzle does not exist', async () => {
      const games = await usePuzzleStore.getState().listGames('/puzzle/nonexistent');
      expect(games).toBeNull();
    });
  });
});
