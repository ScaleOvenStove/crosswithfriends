/**
 * Game Store - Manages game state for collaborative crossword solving
 * Implements REQ-10.1.2: Game state management via Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GameState as _GameState, User, Cell, Clue, Cursor } from '@types/index';

interface GameStore {
  // State
  gameId: string | null;
  puzzleId: string | null;
  cells: Cell[][];
  solution: string[][] | null; // Store puzzle solution for checking
  clues: {
    across: Clue[];
    down: Clue[];
  };
  users: User[];
  currentUser: User | null;
  cursors: Cursor[]; // Other users' cursor positions
  selectedCell: { row: number; col: number } | null;
  selectedDirection: 'across' | 'down';
  isComplete: boolean;
  isPencilMode: boolean;
  isAutoCheckMode: boolean;
  startTime: number | null;
  endTime: number | null;
  clock: {
    isRunning: boolean;
    elapsedTime: number;
  };

  // Actions
  setGameId: (gameId: string) => void;
  setPuzzleId: (puzzleId: string) => void;
  setCells: (cells: Cell[][]) => void;
  setSolution: (solution: string[][]) => void;
  setClues: (clues: { across: Clue[]; down: Clue[] }) => void;
  updateCell: (row: number, col: number, value: string, isPencil?: boolean) => void;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  setCurrentUser: (user: User) => void;
  updateCursor: (userId: string, row: number, col: number) => void;
  setSelectedCell: (row: number, col: number) => void;
  toggleDirection: () => void;
  setSelectedCellAndDirection: (row: number, col: number, direction: 'across' | 'down') => void;
  togglePencilMode: () => void;
  toggleAutoCheckMode: () => void;
  setComplete: (isComplete: boolean) => void;
  startClock: () => void;
  pauseClock: () => void;
  resetClock: () => void;
  updateClock: (elapsedTime: number) => void;
  resetGame: () => void;

  // Game tool actions
  checkCell: (row: number, col: number) => boolean;
  checkWord: (row: number, col: number, direction: 'across' | 'down') => boolean;
  checkPuzzle: () => boolean;
  revealCell: (row: number, col: number) => void;
  revealWord: (row: number, col: number, direction: 'across' | 'down') => void;
  revealPuzzle: () => void;
  resetCell: (row: number, col: number) => void;
  resetWord: (row: number, col: number, direction: 'across' | 'down') => void;
  resetPuzzle: () => void;
}

const initialState = {
  gameId: null,
  puzzleId: null,
  cells: [],
  solution: null,
  clues: {
    across: [],
    down: [],
  },
  users: [],
  currentUser: null,
  cursors: [],
  selectedCell: null,
  selectedDirection: 'across' as const,
  isComplete: false,
  isPencilMode: false,
  isAutoCheckMode: false,
  startTime: null,
  endTime: null,
  clock: {
    isRunning: false,
    elapsedTime: 0,
  },
};

export const useGameStore = create<GameStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setGameId: (gameId) => set({ gameId }),
      setPuzzleId: (puzzleId) => set({ puzzleId }),
      setCells: (cells) => set({ cells }),
      setSolution: (solution) => set({ solution }),
      setClues: (clues) => set({ clues }),

      updateCell: (row, col, value, isPencil = false) =>
        set((state) => {
          const newCells = state.cells.map((r, i) =>
            i === row
              ? r.map((cell, j) =>
                  j === col ? { ...cell, value, isPencil, isGood: false, isBad: false } : cell
                )
              : r
          );
          return { cells: newCells };
        }),

      setUsers: (users) => set({ users }),

      addUser: (user) =>
        set((state) => ({
          users: [...state.users.filter((u) => u.id !== user.id), user],
        })),

      removeUser: (userId) =>
        set((state) => ({
          users: state.users.filter((u) => u.id !== userId),
        })),

      setCurrentUser: (user) => set({ currentUser: user }),

      updateCursor: (userId, row, col) =>
        set((state) => {
          const now = Date.now();
          const CURSOR_TIMEOUT = 5000; // 5 seconds

          // Remove old cursors (older than timeout) and update/add this cursor
          const filteredCursors = state.cursors.filter(
            (c) => c.id !== userId && now - c.timestamp < CURSOR_TIMEOUT
          );

          return {
            cursors: [...filteredCursors, { id: userId, row, col, timestamp: now }],
          };
        }),

      setSelectedCell: (row, col) => set({ selectedCell: { row, col } }),

      toggleDirection: () =>
        set((state) => ({
          selectedDirection: state.selectedDirection === 'across' ? 'down' : 'across',
        })),

      setSelectedCellAndDirection: (row, col, direction) =>
        set({
          selectedCell: { row, col },
          selectedDirection: direction,
        }),

      togglePencilMode: () =>
        set((state) => ({
          isPencilMode: !state.isPencilMode,
        })),

      toggleAutoCheckMode: () =>
        set((state) => ({
          isAutoCheckMode: !state.isAutoCheckMode,
        })),

      setComplete: (isComplete) =>
        set({
          isComplete,
          endTime: isComplete ? Date.now() : null,
        }),

      startClock: () =>
        set((state) => {
          const now = Date.now();
          // If resuming, keep the existing elapsedTime and set new startTime to now
          // If starting fresh, elapsedTime is 0 and we set startTime to now
          // The interval will calculate: total = elapsedTime + (now - startTime) / 1000
          return {
            clock: { ...state.clock, isRunning: true },
            startTime: now, // Always set to now when starting/resuming
          };
        }),

      pauseClock: () =>
        set((state) => {
          // When pausing, calculate total elapsed time and save it
          if (state.startTime) {
            const now = Date.now();
            const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
            const totalElapsedSeconds = state.clock.elapsedTime + currentSessionSeconds;
            return {
              clock: { ...state.clock, isRunning: false, elapsedTime: totalElapsedSeconds },
              startTime: null, // Clear startTime when paused
            };
          }
          return {
            clock: { ...state.clock, isRunning: false },
          };
        }),

      resetClock: () =>
        set({
          clock: { isRunning: false, elapsedTime: 0 },
          startTime: null,
          endTime: null,
        }),

      updateClock: (elapsedTime) =>
        set((state) => ({
          clock: { ...state.clock, elapsedTime },
        })),

      resetGame: () => set({ ...initialState, cursors: [] }),

      // Game tool actions
      checkCell: (row, col) => {
        const state = useGameStore.getState();
        if (!state.solution || !state.solution[row] || !state.cells[row]) {
          return false;
        }
        const correct = state.cells[row][col].value === state.solution[row][col];

        // Update cell with check result
        set((state) => {
          const newCells = state.cells.map((r, i) =>
            i === row
              ? r.map((cell, j) =>
                  j === col
                    ? {
                        ...cell,
                        isGood: correct && cell.value !== '',
                        isBad: !correct && cell.value !== '',
                        isPencil: false, // Remove pencil mode when checking
                      }
                    : cell
                )
              : r
          );
          return { cells: newCells };
        });

        return correct;
      },

      checkWord: (row, col, direction) => {
        const state = useGameStore.getState();
        if (!state.cells[row] || !state.solution) {
          return false;
        }

        const cells = state.cells;
        let allCorrect = true;
        const cellsToCheck: Array<{ row: number; col: number }> = [];

        if (direction === 'across') {
          let startCol = col;
          while (startCol > 0 && !cells[row][startCol - 1].isBlack) {
            startCol--;
          }
          let currentCol = startCol;
          while (currentCol < cells[row].length && !cells[row][currentCol].isBlack) {
            cellsToCheck.push({ row, col: currentCol });
            currentCol++;
          }
        } else {
          let startRow = row;
          while (startRow > 0 && !cells[startRow - 1][col].isBlack) {
            startRow--;
          }
          let currentRow = startRow;
          while (currentRow < cells.length && !cells[currentRow][col].isBlack) {
            cellsToCheck.push({ row: currentRow, col });
            currentRow++;
          }
        }

        // Check all cells in the word and update their state
        set((state) => {
          const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));

          cellsToCheck.forEach(({ row: r, col: c }) => {
            if (state.solution && state.solution[r] && state.solution[r][c] !== undefined) {
              const correct = newCells[r][c].value === state.solution[r][c];
              newCells[r][c] = {
                ...newCells[r][c],
                isGood: correct && newCells[r][c].value !== '',
                isBad: !correct && newCells[r][c].value !== '',
                isPencil: false, // Remove pencil mode when checking
              };
              if (!correct) {
                allCorrect = false;
              }
            }
          });

          return { cells: newCells };
        });

        return allCorrect;
      },

      checkPuzzle: () => {
        const state = useGameStore.getState();
        if (!state.solution) return false;

        let allCorrect = true;

        // Check all cells and update their state
        set((state) => {
          const newCells = state.cells.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
              if (cell.isBlack) {
                return cell;
              }

              const correct = cell.value === state.solution![rowIdx][colIdx];
              if (!correct && cell.value !== '') {
                allCorrect = false;
              }

              return {
                ...cell,
                isGood: correct && cell.value !== '',
                isBad: !correct && cell.value !== '',
                isPencil: false, // Remove pencil mode when checking
              };
            })
          );

          return { cells: newCells };
        });

        return allCorrect;
      },

      revealCell: (row, col) =>
        set((state) => {
          if (!state.solution || !state.solution[row]) return state;

          const newCells = state.cells.map((r, i) =>
            i === row
              ? r.map((cell, j) =>
                  j === col
                    ? {
                        ...cell,
                        value: state.solution![row][col],
                        isPencil: false,
                        isRevealed: true,
                      }
                    : cell
                )
              : r
          );
          return { cells: newCells };
        }),

      revealWord: (row, col, direction) =>
        set((state) => {
          if (!state.solution) return state;

          const cells = state.cells;
          const newCells = cells.map((r) => r.map((c) => ({ ...c })));

          if (direction === 'across') {
            let startCol = col;
            while (startCol > 0 && !cells[row][startCol - 1].isBlack) {
              startCol--;
            }
            let currentCol = startCol;
            while (currentCol < cells[row].length && !cells[row][currentCol].isBlack) {
              newCells[row][currentCol] = {
                ...newCells[row][currentCol],
                value: state.solution[row][currentCol],
                isPencil: false,
                isRevealed: true,
              };
              currentCol++;
            }
          } else {
            let startRow = row;
            while (startRow > 0 && !cells[startRow - 1][col].isBlack) {
              startRow--;
            }
            let currentRow = startRow;
            while (currentRow < cells.length && !cells[currentRow][col].isBlack) {
              newCells[currentRow][col] = {
                ...newCells[currentRow][col],
                value: state.solution[currentRow][col],
                isPencil: false,
                isRevealed: true,
              };
              currentRow++;
            }
          }

          return { cells: newCells };
        }),

      revealPuzzle: () =>
        set((state) => {
          if (!state.solution) return state;

          const newCells = state.cells.map((row, rowIdx) =>
            row.map((cell, colIdx) =>
              cell.isBlack
                ? cell
                : {
                    ...cell,
                    value: state.solution![rowIdx][colIdx],
                    isPencil: false,
                    isRevealed: true,
                  }
            )
          );
          return { cells: newCells, isComplete: true };
        }),

      resetCell: (row, col) =>
        set((state) => {
          const newCells = state.cells.map((r, i) =>
            i === row
              ? r.map((cell, j) =>
                  j === col
                    ? {
                        ...cell,
                        value: '',
                        isPencil: false,
                        isGood: false,
                        isBad: false,
                        isRevealed: false,
                      }
                    : cell
                )
              : r
          );
          return { cells: newCells };
        }),

      resetWord: (row, col, direction) =>
        set((state) => {
          const cells = state.cells;
          const newCells = cells.map((r) => r.map((c) => ({ ...c })));

          if (direction === 'across') {
            let startCol = col;
            while (startCol > 0 && !cells[row][startCol - 1].isBlack) {
              startCol--;
            }
            let currentCol = startCol;
            while (currentCol < cells[row].length && !cells[row][currentCol].isBlack) {
              newCells[row][currentCol] = {
                ...newCells[row][currentCol],
                value: '',
                isPencil: false,
                isGood: false,
                isBad: false,
                isRevealed: false,
              };
              currentCol++;
            }
          } else {
            let startRow = row;
            while (startRow > 0 && !cells[startRow - 1][col].isBlack) {
              startRow--;
            }
            let currentRow = startRow;
            while (currentRow < cells.length && !cells[currentRow][col].isBlack) {
              newCells[currentRow][col] = {
                ...newCells[currentRow][col],
                value: '',
                isPencil: false,
                isGood: false,
                isBad: false,
                isRevealed: false,
              };
              currentRow++;
            }
          }

          return { cells: newCells };
        }),

      resetPuzzle: () =>
        set((state) => {
          const newCells = state.cells.map((row) =>
            row.map((cell) =>
              cell.isBlack
                ? cell
                : {
                    ...cell,
                    value: '',
                    isPencil: false,
                    isGood: false,
                    isBad: false,
                    isRevealed: false,
                  }
            )
          );
          return {
            cells: newCells,
            isComplete: false,
            startTime: null,
            endTime: null,
            clock: { isRunning: false, elapsedTime: 0 },
          };
        }),
    }),
    { name: 'GameStore' }
  )
);
