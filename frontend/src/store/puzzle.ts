import EventEmitter from './EventEmitter';
import _ from 'lodash';
import {db, getTime, type DatabaseReference} from './firebase';
import {ref, onValue, off, get, set, query, orderByChild, equalTo, limitToLast} from 'firebase/database';
import {makeGrid} from '@crosswithfriends/shared/lib/gameUtils';

// a wrapper class that models Puzzle

export default class Puzzle extends EventEmitter {
  ref: DatabaseReference;
  path: string;
  pid: number;
  data: any;

  constructor(path: string, pid: number) {
    super();
    this.path = path;
    this.ref = ref(db, path);
    this.pid = pid;
  }

  attach(): void {
    onValue(this.ref, (snapshot) => {
      this.data = snapshot.val();
      this.emit('ready');
    });
  }

  detach(): void {
    off(this.ref);
  }

  logSolve(gid: string, stats: any): void {
    const statsPath = `/stats/${this.pid}`;
    const statsRef = ref(db, statsPath);
    const puzzlelistPath = `/puzzlelist/${this.pid}`;
    const puzzlelistRef = ref(db, puzzlelistPath);
    set(ref(db, `${statsPath}/solves/${gid}`), stats);
    get(statsRef).then((snapshot) => {
      const stats = snapshot.val();
      const numSolves = _.keys(stats.solves).length;
      set(ref(db, `${puzzlelistPath}/stats/numSolves`), numSolves);
    });
  }

  toGame(): any {
    const {info, circles = [], shades = [], grid: solution, pid} = this.data;
    const gridObject = makeGrid(solution);
    const clues = gridObject.alignClues(this.data.clues);
    const grid = gridObject.toArray();

    const game = {
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
    return game;
  }

  get info(): any {
    if (!this.data) return undefined;
    return this.data.info;
  }

  // return list of games that were played off this puzzle
  // includes beta games, but not solo games
  listGames(limit: number = 100): Promise<any> {
    const gameRef = ref(db, '/game');
    const gamesQuery = query(gameRef, orderByChild('pid'), equalTo(this.pid), limitToLast(limit));
    return get(gamesQuery).then((snapshot) => snapshot.val());
  }
}
