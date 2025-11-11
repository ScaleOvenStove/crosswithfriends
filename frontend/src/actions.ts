import {gameWords} from '@crosswithfriends/shared/lib/names';
import {makeGrid} from '@crosswithfriends/shared/lib/gameUtils';
import {db} from './store/firebase';
import {ref, push, set} from 'firebase/database';
// eslint-disable-next-line import/no-cycle
import {GameModel, PuzzleModel} from './store';
import {incrementGid, incrementPid} from './api/counters';

// for interfacing with firebase

function disconnect(): void {
  // no-op for now
}

interface CreateGameForBattleParams {
  pid: number;
  battleData?: any;
}

interface CreateCompositionParams {
  r: number;
  c: number;
}

const actions = {
  // puzzle: { title, type, grid, clues }
  createPuzzle: async (puzzle: any, cbk?: (pid: number) => void): Promise<void> => {
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
  createGameForBattle: ({pid, battleData}: CreateGameForBattleParams, cbk?: (gid: string) => void): void => {
    actions.getNextGid((gid) => {
      const game = new GameModel(`/game/${gid}`);
      const puzzle = new PuzzleModel(`/puzzle/${pid}`);
      puzzle.attach();
      puzzle.once('ready', () => {
        const rawGame = puzzle.toGame();
        game.initialize(rawGame, {battleData}).then(() => {
          cbk && cbk(gid);
        });
      });
    });
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
