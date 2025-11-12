/**
 * Custom hook for puzzle management
 * Provides puzzle state, actions, and loading states
 */

import {useEffect, useRef} from 'react';
import {usePuzzleStore} from '../store/puzzleStore';
import type {PuzzleData, GameListEntry} from '../types/puzzle';
import type {RawGame} from '../types/rawGame';

interface UsePuzzleOptions {
  path: string;
  pid: number;
  onReady?: (data: PuzzleData) => void;
}

interface UsePuzzleReturn {
  puzzle: ReturnType<typeof usePuzzleStore.getState>['puzzles'][string] | undefined;
  attach: () => void;
  detach: () => void;
  listGames: (limit?: number) => Promise<Record<string, GameListEntry> | null>;
  toGame: () => RawGame | null;
  waitForReady: () => Promise<void>;
  ready: boolean;
  data: PuzzleData | null;
}

export function usePuzzle(options: UsePuzzleOptions): UsePuzzleReturn {
  const {path, pid, onReady} = options;
  const puzzleStore = usePuzzleStore();
  const puzzle = puzzleStore.getPuzzle(path, pid);
  const readyRef = useRef(false);

  // Set up ready listener
  useEffect(() => {
    if (!puzzle || readyRef.current) return;

    const checkReady = () => {
      if (puzzle.ready && !readyRef.current) {
        readyRef.current = true;
        if (onReady && puzzle.data) {
          onReady(puzzle.data);
        }
      }
    };

    // Check immediately
    checkReady();

    // Poll for ready state if not ready yet
    const interval = setInterval(() => {
      const currentPuzzle = puzzleStore.getPuzzle(path, pid);
      if (currentPuzzle?.ready && !readyRef.current) {
        readyRef.current = true;
        clearInterval(interval);
        if (onReady && currentPuzzle.data) {
          onReady(currentPuzzle.data);
        }
      }
    }, 50);

    return () => {
      clearInterval(interval);
    };
  }, [puzzle, path, pid, puzzleStore, onReady]);

  // Return methods directly without memoization - they're not passed as dependencies
  const attach = () => {
    puzzleStore.attach(path);
  };

  const detach = () => {
    puzzleStore.detach(path);
    readyRef.current = false;
  };

  const listGames = (limit: number = 100) => {
    return puzzleStore.listGames(path, limit);
  };

  const toGame = () => {
    return puzzleStore.toGame(path);
  };

  const waitForReady = () => {
    return puzzleStore.waitForReady(path);
  };

  return {
    puzzle,
    attach,
    detach,
    listGames,
    toGame,
    waitForReady,
    ready: puzzle?.ready ?? false,
    data: puzzle?.data ?? null,
  };
}

