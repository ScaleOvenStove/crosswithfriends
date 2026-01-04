/**
 * Composition Store - Manages puzzle composition/creation state
 * Implements REQ-10.1.4: Composition state management via Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Cell, Clue } from '@types/index';
import { generateCluesFromGrid } from '@utils/clueGenerator';

interface CompositionStore {
  // State
  compositionId: string | null;
  title: string;
  author: string;
  width: number;
  height: number;
  cells: Cell[][];
  clues: {
    across: Clue[];
    down: Clue[];
  };
  selectedCell: { row: number; col: number } | null;
  mode: 'grid' | 'clues';
  isDirty: boolean;

  // Actions
  setCompositionId: (id: string) => void;
  setTitle: (title: string) => void;
  setAuthor: (author: string) => void;
  setDimensions: (width: number, height: number) => void;
  setCells: (cells: Cell[][]) => void;
  updateCell: (row: number, col: number, updates: Partial<Cell>) => void;
  toggleBlackSquare: (row: number, col: number) => void;
  toggleCircle: (row: number, col: number) => void;
  setClues: (clues: { across: Clue[]; down: Clue[] }) => void;
  updateClue: (direction: 'across' | 'down', number: number, clue: string) => void;
  regenerateClues: () => void;
  setSelectedCell: (row: number, col: number) => void;
  setMode: (mode: 'grid' | 'clues') => void;
  markDirty: () => void;
  markClean: () => void;
  resetComposition: () => void;
}

const initialState = {
  compositionId: null,
  title: '',
  author: '',
  width: 15,
  height: 15,
  cells: [],
  clues: {
    across: [],
    down: [],
  },
  selectedCell: null,
  mode: 'grid' as const,
  isDirty: false,
};

export const useCompositionStore = create<CompositionStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setCompositionId: (id) => set({ compositionId: id }),

      setTitle: (title) => set({ title, isDirty: true }),

      setAuthor: (author) => set({ author, isDirty: true }),

      setDimensions: (width, height) =>
        set({
          width,
          height,
          cells: Array(height)
            .fill(null)
            .map(() =>
              Array(width)
                .fill(null)
                .map(() => ({
                  value: '',
                  isPencil: false,
                  isBlack: false,
                  hasCircle: false,
                }))
            ),
          isDirty: true,
        }),

      setCells: (cells) => set({ cells, isDirty: true }),

      updateCell: (row, col, updates) =>
        set((state) => {
          const newCells = state.cells.map((r, i) =>
            i === row ? r.map((cell, j) => (j === col ? { ...cell, ...updates } : cell)) : r
          );
          return { cells: newCells, isDirty: true };
        }),

      toggleBlackSquare: (row, col) =>
        set((state) => {
          const newCells = state.cells.map((r, i) =>
            i === row
              ? r.map((cell, j) => (j === col ? { ...cell, isBlack: !cell.isBlack } : cell))
              : r
          );
          return { cells: newCells, isDirty: true };
        }),

      toggleCircle: (row, col) =>
        set((state) => {
          const newCells = state.cells.map((r, i) =>
            i === row
              ? r.map((cell, j) => (j === col ? { ...cell, hasCircle: !cell.hasCircle } : cell))
              : r
          );
          return { cells: newCells, isDirty: true };
        }),

      setClues: (clues) => set({ clues, isDirty: true }),

      updateClue: (direction, number, clue) =>
        set((state) => {
          const newClues = {
            ...state.clues,
            [direction]: state.clues[direction].map((c) =>
              c.number === number ? { ...c, clue } : c
            ),
          };
          return { clues: newClues, isDirty: true };
        }),

      regenerateClues: () =>
        set((state) => {
          const newClues = generateCluesFromGrid(state.cells, state.clues);
          return { clues: newClues, isDirty: true };
        }),

      setSelectedCell: (row, col) => set({ selectedCell: { row, col } }),

      setMode: (mode) => set({ mode }),

      markDirty: () => set({ isDirty: true }),

      markClean: () => set({ isDirty: false }),

      resetComposition: () => set(initialState),
    }),
    { name: 'CompositionStore' }
  )
);
