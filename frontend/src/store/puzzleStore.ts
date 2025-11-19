import {makeGrid} from '@crosswithfriends/shared/lib/gameUtils';
import {ref, onValue, get, set, query, orderByChild, equalTo, limitToLast} from 'firebase/database';
import _ from 'lodash';
import {create} from 'zustand';

import type {PuzzleData, PuzzleSolveStats, GameListEntry} from '../types/puzzle';
import type {RawGame} from '../types/rawGame';

import {db, type DatabaseReference} from './firebase';

interface PuzzleInstance {
  ref: DatabaseReference;
  path: string;
  pid: number;
  data: PuzzleData | null;
  ready: boolean;
}

interface PuzzleStore {
  puzzles: Record<string, PuzzleInstance>;
  getPuzzle: (path: string, pid: number) => PuzzleInstance;
  attach: (path: string) => void;
  detach: (path: string) => void;
  waitForReady: (path: string, timeoutMs?: number) => Promise<void>;
  logSolve: (path: string, gid: string, stats: PuzzleSolveStats) => void;
  toGame: (path: string) => RawGame | null;
  listGames: (path: string, limit?: number) => Promise<Record<string, GameListEntry> | null>;
}

export const usePuzzleStore = create<PuzzleStore>((setState, getState) => {
  const listeners: Record<string, () => void> = {};

  return {
    puzzles: {},

    getPuzzle: (path: string, pid: number) => {
      const state = getState();
      if (!state.puzzles[path]) {
        const puzzleRef = ref(db, path);
        const newPuzzle: PuzzleInstance = {
          ref: puzzleRef,
          path,
          pid,
          data: null,
          ready: false,
        };
        setState({
          puzzles: {
            ...state.puzzles,
            [path]: newPuzzle,
          },
        });
        return newPuzzle;
      }
      return state.puzzles[path];
    },

    attach: (path: string) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle || listeners[path]) return;

      const unsubscribe = onValue(puzzle.ref, (snapshot) => {
        setState({
          puzzles: {
            ...state.puzzles,
            [path]: {
              ...puzzle,
              data: snapshot.val(),
              ready: true,
            },
          },
        });
      });

      listeners[path] = unsubscribe;
    },

    detach: (path: string) => {
      const unsubscribe = listeners[path];
      if (unsubscribe) {
        unsubscribe();
        delete listeners[path];
      }
    },

    waitForReady: (path: string, timeoutMs: number = 10000): Promise<void> => {
      return new Promise((resolve, reject) => {
        const state = getState();
        const puzzle = state.puzzles[path];
        if (puzzle?.ready) {
          resolve();
          return;
        }

        const startTime = Date.now();
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;

        const clearTimers = () => {
          if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          if (pollHandle !== null) {
            clearTimeout(pollHandle);
            pollHandle = null;
          }
        };

        // Set up timeout
        timeoutHandle = setTimeout(() => {
          clearTimers();
          reject(new Error(`waitForReady timed out after ${timeoutMs}ms for puzzle at ${path}`));
        }, timeoutMs);

        // Poll for ready state
        const checkReady = () => {
          const currentState = getState();
          const currentPuzzle = currentState.puzzles[path];
          if (currentPuzzle?.ready) {
            clearTimers();
            resolve();
          } else {
            const elapsed = Date.now() - startTime;
            if (elapsed >= timeoutMs) {
              clearTimers();
              reject(new Error(`waitForReady timed out after ${timeoutMs}ms for puzzle at ${path}`));
            } else {
              pollHandle = setTimeout(checkReady, 50);
            }
          }
        };
        checkReady();
      });
    },

    logSolve: (path: string, gid: string, stats: PuzzleSolveStats) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle) return;

      const statsPath = `/stats/${puzzle.pid}`;
      const statsRef = ref(db, statsPath);
      const puzzlelistPath = `/puzzlelist/${puzzle.pid}`;
      set(ref(db, `${statsPath}/solves/${gid}`), stats);
      get(statsRef).then((snapshot) => {
        const statsData = snapshot.val() as {solves?: Record<string, unknown>} | null;
        if (statsData?.solves) {
          const numSolves = _.keys(statsData.solves).length;
          set(ref(db, `${puzzlelistPath}/stats/numSolves`), numSolves);
        }
      });
    },

    toGame: (path: string) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle || !puzzle.data) return null;

      // Read from ipuz format
      const ipuz = puzzle.data;
      const solution = (ipuz.solution || []).map((row: (string | null)[]) =>
        row.map((cell: string | null) => (cell === null ? '.' : cell))
      );

      if (!solution || solution.length === 0) {
        return null;
      }

      // Extract circles and shades from puzzle grid
      // ipuz format: puzzle grid can contain numbers, "#", objects with {cell, style}, or null
      const circles: Array<{r: number; c: number}> = [];
      const shades: Array<{r: number; c: number}> = [];
      const puzzleGrid = (ipuz.puzzle || []) as (number | string | {cell: number; style?: any} | null)[][];
      puzzleGrid.forEach(
        (row: (number | string | {cell: number; style?: any} | null)[], rowIndex: number) => {
          row.forEach((cell: number | string | {cell: number; style?: any} | null, cellIndex: number) => {
            if (cell && typeof cell === 'object' && 'cell' in cell) {
              // Cell object with style
              if (cell.style?.shapebg === 'circle') {
                circles.push({r: rowIndex, c: cellIndex});
              }
              if (cell.style?.fillbg) {
                shades.push({r: rowIndex, c: cellIndex});
              }
            }
          });
        }
      );

      // Convert ipuz clues format
      const convertClues = (clueArray: any[]): string[] => {
        const result: string[] = [];
        clueArray.forEach((item) => {
          if (Array.isArray(item) && item.length >= 2) {
            const num = parseInt(item[0], 10);
            if (!isNaN(num)) {
              result[num] = item[1];
            }
          } else if (item && typeof item === 'object' && item.number && item.clue) {
            const num = parseInt(item.number, 10);
            if (!isNaN(num)) {
              result[num] = item.clue;
            }
          }
        });
        return result;
      };

      const acrossClues = convertClues(ipuz.clues?.across || []);
      const downClues = convertClues(ipuz.clues?.down || []);

      const gridObject = makeGrid(solution);
      const clues = gridObject.alignClues({across: acrossClues, down: downClues});
      const grid = gridObject.toArray();

      // Build info object from ipuz format
      const type = solution.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';
      const info = {
        title: (ipuz.title as string | undefined) || '',
        author: (ipuz.author as string | undefined) || '',
        copyright: (ipuz.copyright as string | undefined) || '',
        description: (ipuz.notes as string | undefined) || '',
        type,
      };

      const rawGame: RawGame = {
        info,
        circles,
        shades,
        clues,
        solution,
        pid: puzzle.pid,
        grid,
        chat: {
          users: [],
          messages: [],
        },
      };
      return rawGame;
    },

    listGames: async (path: string, limit: number = 100) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle) return null;

      const gameRef = ref(db, '/game');
      const gamesQuery = query(gameRef, orderByChild('pid'), equalTo(puzzle.pid), limitToLast(limit));
      const snapshot = await get(gamesQuery);
      return snapshot.val() as Record<string, GameListEntry> | null;
    },
  };
});
