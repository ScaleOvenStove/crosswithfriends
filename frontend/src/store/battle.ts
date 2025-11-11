import EventEmitter from './EventEmitter';
import _ from 'lodash';
import {db, type DatabaseReference} from './firebase';
import {ref, onValue, off, get, set, push, remove} from 'firebase/database';
// eslint-disable-next-line import/no-cycle
import actions from '../actions';

import powerupData from '@crosswithfriends/shared/lib/powerups';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
// eslint-disable-next-line import/no-cycle
import {PuzzleModel} from '.';

const STARTING_POWERUPS = 1;
const NUM_PICKUPS = 10;
const MAX_ON_BOARD = 3;
const VALUE_LISTENERS = ['games', 'powerups', 'startedAt', 'players', 'winner', 'pickups'];

export default class Battle extends EventEmitter {
  path: string;
  ref: DatabaseReference;
  gids?: string[];

  constructor(path: string) {
    super();
    this.path = path;
    this.ref = ref(db, path);
  }

  attach(): void {
    VALUE_LISTENERS.forEach((subpath) => {
      const subRef = ref(db, `${this.path}/${subpath}`);
      onValue(subRef, (snapshot) => {
        this.emit(subpath, snapshot.val());
      });
    });
  }

  detach(): void {
    VALUE_LISTENERS.forEach((subpath) => {
      const subRef = ref(db, `${this.path}/${subpath}`);
      off(subRef);
    });
  }

  start(): void {
    set(ref(db, `${this.path}/startedAt`), Date.now());
  }

  setSolved(team: number): void {
    // Obviously this has a race. TODO: Figure out atomicity later...
    get(ref(db, `${this.path}/winner`)).then((snapshot) => {
      if (snapshot.val()) {
        return;
      }

      set(ref(db, `${this.path}/winner`), {
        team,
        completedAt: Date.now(),
      });
    });
  }

  addPlayer(name: string, team: number): void {
    push(ref(db, `${this.path}/players`), {name, team});
  }

  removePlayer(name: string, team: number): void {
    get(ref(db, `${this.path}/players`)).then((snapshot) => {
      const players = snapshot.val();
      const playerToRemove = _.findKey(players, {name, team});
      if (playerToRemove) {
        remove(ref(db, `${this.path}/players/${playerToRemove}`));
      }
    });
  }

  usePowerup(type: string, team: number): void {
    get(ref(db, `${this.path}/powerups`)).then((snapshot) => {
      const allPowerups = snapshot.val();
      const ownPowerups = allPowerups[team];
      const toUse = _.find(ownPowerups, (powerup: any) => powerup.type === type && !powerup.used);
      if (toUse) {
        this.emit('usePowerup', toUse);
        toUse.used = Date.now();
        toUse.target = 1 - team; // For now use on other team.
        set(ref(db, `${this.path}/powerups`), allPowerups);
      }
    });
  }

  // TODO: This is going to have races, figure out how to use the game reducer later.
  checkPickups(r: number, c: number, game: any, team: number): void {
    const {grid, solution} = game;
    const gridObj = new GridObject(grid);

    get(ref(db, `${this.path}/pickups`)).then((snapshot1) => {
      const pickups = snapshot1.val();

      get(ref(db, `${this.path}/powerups`)).then((snapshot2) => {
        const powerups = snapshot2.val();

        const pickupIfCorrect = (cells: any[]) => {
          const isCorrect = _.every(
            cells,
            ({i, j}: {i: number; j: number}) => grid[i][j].value === solution[i][j]
          );
          if (!isCorrect) return;

          _.forEach(pickups, (pickup: any) => {
            if (pickup.pickedUp) return;
            const {i, j, type} = pickup;
            const foundMatch = _.find(cells, {i, j});
            if (!foundMatch) return;

            pickup.pickedUp = true;
            powerups[team].push({type});
          });
        };

        const {across, down} = gridObj.getCrossingWords(r, c);
        pickupIfCorrect(across);
        pickupIfCorrect(down);

        set(ref(db, `${this.path}/pickups`), pickups);
        set(ref(db, `${this.path}/powerups`), powerups);
      });
    });
  }

  countLivePickups(cbk: (count: number) => void): void {
    get(ref(db, `${this.path}/pickups`)).then((snapshot) => {
      const pickups = snapshot.val();
      const live = _.filter(pickups, (p: any) => !p.pickedUp);
      cbk(live.length);
    });
  }

  spawnPowerups(n: number, games: any[], cbk?: () => void): void {
    const possibleLocationsPerGrid = _.map(games, (game) => {
      const {grid, solution} = game;
      const gridObj = new GridObject(grid);
      return gridObj.getPossiblePickupLocations(solution);
    });

    this.countLivePickups((currentNum) => {
      if (currentNum > MAX_ON_BOARD) return;
      const possibleLocations = _.intersectionWith(...possibleLocationsPerGrid, _.isEqual);

      const locations = _.sampleSize(possibleLocations, n);

      const powerupTypes = _.keys(powerupData);
      const pickups = _.map(locations, ({i, j}: {i: number; j: number}) => ({
        i,
        j,
        type: _.sample(powerupTypes),
      }));

      Promise.all(
        pickups.map((pickup: any) => {
          return push(ref(db, `${this.path}/pickups`), pickup).then(() => {});
        })
      ).then(() => {
        if (cbk) cbk();
      });
    });
  }

  initialize(pid: number, bid: number, teams: number = 2): void {
    const args = _.map(_.range(teams), (team) => ({
      pid,
      battleData: {bid, team},
    }));

    const powerupTypes = _.keys(powerupData);
    const powerups = _.map(_.range(teams), () =>
      _.map(_.sampleSize(powerupTypes, STARTING_POWERUPS), (type) => ({type}))
    );

    const puzzle = new PuzzleModel(`/puzzle/${pid}`);
    puzzle.attach();
    puzzle.once('ready', () => {
      const rawGame = puzzle.toGame();
      puzzle.detach();

      // Need to wait for all of these to finish otherwise the redirect on emit(ready) kills things.
      Promise.all(
        args.map((arg) => {
          return new Promise<string>((resolve) => {
            actions.createGameForBattle(arg, (gid: string) => {
              resolve(gid);
            });
          });
        })
      ).then((gids: string[]) => {
        this.gids = gids;
        set(ref(db, `${this.path}/games`), gids).then(() => {
          set(ref(db, `${this.path}/powerups`), powerups).then(() => {
            this.spawnPowerups(NUM_PICKUPS, [rawGame], () => {
              this.emit('ready');
            });
          });
        });
      });
    });
  }
}
