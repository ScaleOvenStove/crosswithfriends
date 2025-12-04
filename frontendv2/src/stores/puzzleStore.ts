/**
 * Puzzle Store - Manages puzzle data and metadata
 * Implements REQ-10.1.6: Puzzle data management via Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Puzzle } from '@types/index';

interface PuzzleStore {
  // State
  puzzles: Map<string, Puzzle>;
  currentPuzzle: Puzzle | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPuzzle: (puzzle: Puzzle) => void;
  setPuzzles: (puzzles: Puzzle[]) => void;
  setCurrentPuzzle: (puzzleId: string) => void;
  addPuzzle: (puzzle: Puzzle) => void;
  removePuzzle: (puzzleId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearPuzzles: () => void;
}

export const usePuzzleStore = create<PuzzleStore>()(
  devtools(
    (set, get) => ({
      puzzles: new Map(),
      currentPuzzle: null,
      isLoading: false,
      error: null,

      setPuzzle: (puzzle) =>
        set((state) => {
          const newPuzzles = new Map(state.puzzles);
          newPuzzles.set(puzzle.id, puzzle);
          return { puzzles: newPuzzles };
        }),

      setPuzzles: (puzzles) =>
        set({
          puzzles: new Map(puzzles.map((p) => [p.id, p])),
        }),

      setCurrentPuzzle: (puzzleId) =>
        set((state) => ({
          currentPuzzle: state.puzzles.get(puzzleId) || null,
        })),

      addPuzzle: (puzzle) =>
        set((state) => {
          const newPuzzles = new Map(state.puzzles);
          newPuzzles.set(puzzle.id, puzzle);
          return { puzzles: newPuzzles };
        }),

      removePuzzle: (puzzleId) =>
        set((state) => {
          const newPuzzles = new Map(state.puzzles);
          newPuzzles.delete(puzzleId);
          return {
            puzzles: newPuzzles,
            currentPuzzle: state.currentPuzzle?.id === puzzleId ? null : state.currentPuzzle,
          };
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      clearPuzzles: () =>
        set({
          puzzles: new Map(),
          currentPuzzle: null,
        }),
    }),
    { name: 'PuzzleStore' }
  )
);
