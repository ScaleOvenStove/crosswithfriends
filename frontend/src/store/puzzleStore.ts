import {create} from 'zustand';
import {ref, onValue, off, get, set, query, orderByChild, equalTo, limitToLast} from 'firebase/database';
import {db, getTime, type DatabaseReference} from './firebase';
import {makeGrid} from '@crosswithfriends/shared/lib/gameUtils';
import _ from 'lodash';

import type {PuzzleData, PuzzleSolveStats, GameListEntry} from '../types/puzzle';
import type {RawGame} from '../types/rawGame';

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
  waitForReady: (path: string) => Promise<void>;
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
        setState({
          puzzles: {
            ...state.puzzles,
            [path]: {
              ref: puzzleRef,
              path,
              pid,
              data: null,
              ready: false,
            },
          },
        });
      }
      return getState().puzzles[path];
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

    waitForReady: (path: string): Promise<void> => {
      return new Promise((resolve) => {
        const state = getState();
        const puzzle = state.puzzles[path];
        if (puzzle?.ready) {
          resolve();
          return;
        }

        // Poll for ready state
        const checkReady = () => {
          const currentState = getState();
          const currentPuzzle = currentState.puzzles[path];
          if (currentPuzzle?.ready) {
            resolve();
          } else {
            setTimeout(checkReady, 50);
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

      const {info, circles = [], shades = [], grid: solution, pid} = puzzle.data;
      if (!solution) {
        return null;
      }
      const gridObject = makeGrid(solution);
      const clues = gridObject.alignClues(puzzle.data.clues || {across: [], down: []});
      const grid = gridObject.toArray();

      const rawGame: RawGame = {
        info,
        circles,
        shades,
        clues,
        solution,
        pid,
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
