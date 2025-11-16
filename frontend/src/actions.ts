import {makeGrid} from '@crosswithfriends/shared/lib/gameUtils';
import {gameWords} from '@crosswithfriends/shared/lib/names';
import type {PuzzleJson} from '@crosswithfriends/shared/types';
import {ref, push, set} from 'firebase/database';

import {incrementGid, incrementPid} from './api/counters';
import {db} from './store/firebase';
import {useGameStore} from './store/gameStore';
import {usePuzzleStore} from './store/puzzleStore';
import type {BattleData} from './types/rawGame';

// for interfacing with firebase

function disconnect(): void {
  // no-op for now
}

interface CreateGameForBattleParams {
  pid: number;
  battleData?: BattleData;
}

interface CreateCompositionParams {
  r: number;
  c: number;
}

const actions = {
  // puzzle: { title, type, grid, clues }
  createPuzzle: async (puzzle: PuzzleJson, cbk?: (pid: number) => void): Promise<void> => {
    const {pid} = await incrementPid();
    cbk && cbk(pid);
  },

  getNextGid: async (cbk: (gid: string) => void): Promise<void> => {
    const {gid} = await incrementGid();
    const word = gameWords[Math.floor(Math.random() * gameWords.length)];
    cbk(`${gid}-${word}`);
  },

  getNextBid: (cbk: (bid: number) => void): void => {
    // Copying Cid logic for now...
    const NUM_BIDS = 100000000;
    const bid = Math.floor(Math.random() * NUM_BIDS);
    cbk(bid);
  },

  getNextCid: (cbk: (cid: string) => void): void => {
    const NUM_CIDS = 1000000;
    for (let tries = 0; tries < 10; tries += 1) {
      const cid = `${NUM_CIDS + Math.floor(Math.random() * NUM_CIDS)}`.substring(1);
      cbk(cid);
    }
  },

  // TODO: this should probably be createGame and the above should be deleted but idk what it does...
  createGameForBattle: async (
    {pid, battleData}: CreateGameForBattleParams,
    cbk?: (gid: string) => void
  ): Promise<void> => {
    const {gid} = await incrementGid();
    const word = gameWords[Math.floor(Math.random() * gameWords.length)];
    const finalGid = `${gid}-${word}`;

    const gamePath = `/game/${finalGid}`;
    const puzzlePath = `/puzzle/${pid}`;

    const gameStore = useGameStore.getState();
    const puzzleStore = usePuzzleStore.getState();

    // Get puzzle instance
    puzzleStore.getPuzzle(puzzlePath, pid);
    puzzleStore.attach(puzzlePath);

    try {
      // Wait for puzzle to be ready
      await puzzleStore.waitForReady(puzzlePath);

      // Convert puzzle to game format
      const rawGame = puzzleStore.toGame(puzzlePath);

      if (!rawGame) {
        throw new Error('Failed to convert puzzle to game');
      }

      // Initialize game using Zustand store
      await gameStore.initialize(gamePath, rawGame, {battleData});

      if (cbk) {
        cbk(finalGid);
      }
    } finally {
      // Detach puzzle after use to prevent listener leaks
      puzzleStore.detach(puzzlePath);
    }
  },

  createComposition: (
    dims: CreateCompositionParams,
    pattern: number[][],
    cbk: (cid: string) => void
  ): void => {
    const type = Math.max(dims.r, dims.c) <= 7 ? 'Mini Puzzle' : 'Daily Puzzle';
    const textGrid = pattern.map((row) => row.map((cell) => (cell === 0 ? '' : '.')));
    const grid = makeGrid(textGrid);
    const composition = {
      info: {
        title: 'Untitled',
        type,
        author: 'Anonymous',
      },
      grid: grid.toArray(),
      clues: grid.alignClues([]),
      published: false,
    };
    const compositionRef = ref(db, 'composition');
    push(compositionRef, composition).then((newRef) => {
      const cid = newRef.key;
      if (cid) {
        set(ref(db, `composition/${cid}`), composition).then(() => {
          cbk(cid);
        });
      }
    });
  },
};

export {db, disconnect};
export default actions;
