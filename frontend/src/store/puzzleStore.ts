import {create} from 'zustand';
import {ref, onValue, off, get, set, query, orderByChild, equalTo, limitToLast} from 'firebase/database';
import {db, getTime, type DatabaseReference} from './firebase';
import {makeGrid} from '@crosswithfriends/shared/lib/gameUtils';
import _ from 'lodash';

interface PuzzleInstance {
  ref: DatabaseReference;
  path: string;
  pid: number;
  data: any;
  ready: boolean;
}

interface PuzzleStore {
  puzzles: Record<string, PuzzleInstance>;
  getPuzzle: (path: string, pid: number) => PuzzleInstance;
  attach: (path: string) => void;
  detach: (path: string) => void;
  logSolve: (path: string, gid: string, stats: any) => void;
  toGame: (path: string) => any;
  listGames: (path: string, limit?: number) => Promise<any>;
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

    logSolve: (path: string, gid: string, stats: any) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle) return;

      const statsPath = `/stats/${puzzle.pid}`;
      const statsRef = ref(db, statsPath);
      const puzzlelistPath = `/puzzlelist/${puzzle.pid}`;
      set(ref(db, `${statsPath}/solves/${gid}`), stats);
      get(statsRef).then((snapshot) => {
        const stats = snapshot.val();
        const numSolves = _.keys(stats.solves).length;
        set(ref(db, `${puzzlelistPath}/stats/numSolves`), numSolves);
      });
    },

    toGame: (path: string) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle || !puzzle.data) return null;

      const {info, circles = [], shades = [], grid: solution, pid} = puzzle.data;
      const gridObject = makeGrid(solution);
      const clues = gridObject.alignClues(puzzle.data.clues);
      const grid = gridObject.toArray();

      return {
        info,
        circles,
        shades,
        clues,
        solution,
        pid,
        grid,
        createTime: getTime(),
        startTime: null,
        chat: {
          users: [],
          messages: [],
        },
      };
    },

    listGames: async (path: string, limit: number = 100) => {
      const state = getState();
      const puzzle = state.puzzles[path];
      if (!puzzle) return null;

      const gameRef = ref(db, '/game');
      const gamesQuery = query(gameRef, orderByChild('pid'), equalTo(puzzle.pid), limitToLast(limit));
      const snapshot = await get(gamesQuery);
      return snapshot.val();
    },
  };
});
