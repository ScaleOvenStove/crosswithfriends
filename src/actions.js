import {gameWords} from './lib/names';
import firebase from './store/firebase';
// eslint-disable-next-line import/no-cycle
import {GameModel, PuzzleModel} from './store';
import {incrementGid, incrementPid} from './api/counters';

// for interfacing with firebase

const db = firebase.database();
function disconnect() {
  // no-op for now
}

const actions = {
  // puzzle: { title, type, grid, clues }
  createPuzzle: async (puzzle, cbk) => {
    const {pid} = await incrementPid();
    cbk && cbk(pid);
  },

  getNextGid: async (cbk) => {
    const {gid} = await incrementGid();
    const word = gameWords[Math.floor(Math.random() * gameWords.length)];
    cbk(`${gid}-${word}`);
  },

  getNextBid: (cbk) => {
    // Copying Cid logic for now...
    const NUM_BIDS = 100000000;
    const bid = Math.floor(Math.random() * NUM_BIDS);
    cbk(bid);
  },

  // TODO: this should probably be createGame and the above should be deleted but idk what it does...
  createGameForBattle: ({pid, battleData}, cbk) => {
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
};

export {db, disconnect};
export default actions;
