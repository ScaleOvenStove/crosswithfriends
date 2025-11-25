import powerupData from '@crosswithfriends/shared/lib/powerups';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import {ref, onValue, get, set, push, remove, runTransaction} from 'firebase/database';
import {create} from 'zustand';

const findKey = <T>(
  obj: Record<string, T>,
  predicate: ((value: T) => boolean) | Partial<T>
): string | undefined => {
  const predicateFn =
    typeof predicate === 'function'
      ? predicate
      : (value: T) => {
          return Object.keys(predicate).every(
            (key) => (value as any)[key] === (predicate as any)[key]
          );
        };
  return Object.keys(obj).find((key) => predicateFn(obj[key]));
};

const isEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
  }
  return true;
};

const intersectionWith = <T>(
  ...args: [...T[][], (a: T, b: T) => boolean]
): T[] => {
  if (args.length === 0) return [];
  if (args.length === 1) return [];

  const comparator = args[args.length - 1] as (a: T, b: T) => boolean;
  const arrays = args.slice(0, -1) as T[][];

  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0] || [];

  const [first, ...rest] = arrays;
  if (!first) return [];

  return first.filter((item) =>
    rest.every((arr) => arr && arr.some((other) => comparator(item, other)))
  );
};

const sample = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

const sampleSize = <T>(arr: T[], n: number): T[] => {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

import actions from '../actions';
import type {Powerup} from '../types/battle';
import type {RawGame} from '../types/rawGame';
import {logger} from '../utils/logger';
import {createSubscriptionHelpers} from '../utils/subscriptionHelpers';

import {db, type DatabaseReference} from './firebase';
import {usePuzzleStore} from './puzzleStore';

const STARTING_POWERUPS = 1;
const NUM_PICKUPS = 10;
const MAX_ON_BOARD = 3;
const VALUE_LISTENERS = ['games', 'powerups', 'startedAt', 'players', 'winner', 'pickups'];

interface BattleInstance {
  path: string;
  ref: DatabaseReference;
  gids?: string[];
  subscriptions: Map<string, Set<(data: unknown) => void>>; // Map-based subscription system
  unsubscribes: Record<string, () => void>;
}

interface BattleStore {
  battles: Record<string, BattleInstance>;
  getBattle: (path: string) => BattleInstance | undefined;
  attach: (path: string) => void;
  detach: (path: string) => void;
  start: (path: string) => void;
  setSolved: (path: string, team: number) => void;
  addPlayer: (path: string, name: string, team: number) => void;
  removePlayer: (path: string, name: string, team: number) => void;
  usePowerup: (path: string, type: string, team: number) => void;
  checkPickups: (path: string, r: number, c: number, game: RawGame, team: number) => void;
  countLivePickups: (path: string, cbk: (count: number) => void) => void;
  spawnPowerups: (path: string, n: number, games: RawGame[], cbk?: () => void) => void;
  initialize: (path: string, pid: number, bid: number, teams?: number) => void;
  subscribe: (path: string, event: string, callback: (...args: unknown[]) => void) => () => void;
  once: (path: string, event: string, callback: (...args: unknown[]) => void) => () => void; // Subscribe once, auto-unsubscribe after first call
}

export const useBattleStore = create<BattleStore>((setState, getState) => {
  // Use shared subscription helpers to eliminate code duplication
  const {emit, subscribe, once} = createSubscriptionHelpers(() => getState().battles);

  return {
    battles: {},

    getBattle: (path: string) => {
      const state = getState();
      if (!state.battles[path]) {
        const battleRef = ref(db, path);
        setState({
          battles: {
            ...state.battles,
            [path]: {
              path,
              ref: battleRef,
              subscriptions: new Map(),
              unsubscribes: {},
            },
          },
        });
      }
      return getState().battles[path];
    },

    attach: (path: string) => {
      const state = getState();
      let battle = state.battles[path];
      if (!battle) {
        battle = state.getBattle(path);
      }

      if (!battle) {
        logger.error('Failed to get battle instance for path', {path});
        return;
      }

      const unsubscribes: Record<string, () => void> = {};

      VALUE_LISTENERS.forEach((subpath) => {
        const subRef = ref(db, `${path}/${subpath}`);
        const unsubscribe = onValue(subRef, (snapshot) => {
          emit(path, subpath, snapshot.val());
        });
        unsubscribes[subpath] = unsubscribe;
      });

      setState({
        battles: {
          ...state.battles,
          [path]: {
            ...battle,
            unsubscribes,
          },
        },
      });
    },

    detach: (path: string) => {
      const state = getState();
      const battle = state.battles[path];
      if (!battle) return;

      // Check if already detached (no unsubscribes to clean up)
      const hasUnsubscribes = battle.unsubscribes && Object.keys(battle.unsubscribes).length > 0;
      if (!hasUnsubscribes) return; // Already detached, nothing to do

      // Unsubscribe from all Firebase listeners
      Object.values(battle.unsubscribes).forEach((unsubscribe) => unsubscribe());

      // Update state to mark as detached
      setState({
        battles: {
          ...state.battles,
          [path]: {
            ...battle,
            unsubscribes: {},
            subscriptions: new Map(),
          },
        },
      });
    },

    // Use shared subscription methods - eliminates ~80 lines of duplicate code
    subscribe,
    once,

    start: (path: string) => {
      set(ref(db, `${path}/startedAt`), Date.now());
    },

    setSolved: (path: string, team: number) => {
      // Use transaction to atomically check and set winner
      runTransaction(ref(db, `${path}/winner`), (current: unknown) => {
        // If winner already exists, don't overwrite
        if (current) {
          return current;
        }
        // Atomically set winner
        return {
          team,
          completedAt: Date.now(),
        };
      });
    },

    addPlayer: (path: string, name: string, team: number) => {
      push(ref(db, `${path}/players`), {name, team});
    },

    removePlayer: async (path: string, name: string, team: number) => {
      try {
        const snapshot = await get(ref(db, `${path}/players`));
        const players = snapshot.val();
        if (!players) return; // Handle null case

        const playerToRemove = findKey(players, {name, team});
        if (playerToRemove) {
          await remove(ref(db, `${path}/players/${playerToRemove}`));
        }
      } catch (error) {
        logger.errorWithException('Error removing player', error, {path, name, team});
      }
    },

    usePowerup: async (path: string, type: string, team: number) => {
      try {
        const snapshot = await get(ref(db, `${path}/powerups`));
        const allPowerups = snapshot.val();
        if (!allPowerups) return; // Handle null case

        const ownPowerups = allPowerups[team];
        if (!ownPowerups) return; // Handle missing team

        const toUse = ownPowerups.find((powerup: Powerup) => powerup.type === type && !powerup.used);
        if (toUse) {
          emit(path, 'usePowerup', toUse);
          toUse.used = Date.now();
          toUse.target = 1 - team; // For now use on other team.
          await set(ref(db, `${path}/powerups`), allPowerups);
        }
      } catch (error) {
        logger.errorWithException('Error using powerup', error, {path, type, team});
      }
    },

    checkPickups: (
      path: string,
      r: number,
      c: number,
      game: {grid: unknown[][]; solution: string[][]},
      team: number
    ) => {
      const {grid, solution} = game;
      const gridObj = new GridObject(grid);

      // Use transactions to atomically update both pickups and powerups
      // First, get the current state to determine what needs to be updated
      Promise.all([get(ref(db, `${path}/pickups`)), get(ref(db, `${path}/powerups`))]).then(
        ([pickupsSnapshot]) => {
          const pickups = (pickupsSnapshot.val() || {}) as Record<
            string,
            {pickedUp?: boolean; type: string; i: number; j: number}
          >;

          const {across, down} = gridObj.getCrossingWords(r, c);
          const cellsToCheck = [...across, ...down];

          // Determine which pickups should be collected
          const pickupsToMark: string[] = [];
          const powerupsToAdd: Array<{type: string}> = [];

          cellsToCheck.forEach(({i, j}: {i: number; j: number}) => {
            const gridCell = grid[i]?.[j] as {value?: string} | undefined;
            const solutionCell = solution[i]?.[j];
            if (!gridCell || gridCell.value !== solutionCell) return;

            Object.entries(pickups).forEach(([key, pickup]) => {
              if (pickup.pickedUp) return;
              if (pickup.i === i && pickup.j === j) {
                pickupsToMark.push(key);
                powerupsToAdd.push({type: pickup.type});
              }
            });
          });

          // If no pickups to collect, return early
          if (pickupsToMark.length === 0) return;

          // Atomically update pickups
          runTransaction(ref(db, `${path}/pickups`), (currentPickups: unknown) => {
            const updated = {...((currentPickups as Record<string, unknown>) || {})};
            pickupsToMark.forEach((key) => {
              const pickup = updated[key] as {pickedUp?: boolean} | undefined;
              if (pickup && !pickup.pickedUp) {
                updated[key] = {...pickup, pickedUp: true};
              }
            });
            return updated;
          });

          // Atomically update powerups
          runTransaction(ref(db, `${path}/powerups`), (currentPowerups: unknown) => {
            const updated = {...((currentPowerups as Record<number, unknown[]>) || {})};
            if (!updated[team]) {
              updated[team] = [];
            }
            // Only add powerups that weren't already added
            const existingPowerups = updated[team] as Array<{type: string}>;
            powerupsToAdd.forEach((powerup) => {
              if (!existingPowerups.some((p) => p.type === powerup.type)) {
                existingPowerups.push(powerup);
              }
            });
            updated[team] = existingPowerups;
            return updated;
          });
        }
      );
    },

    countLivePickups: async (path: string, cbk: (count: number) => void) => {
      try {
        const snapshot = await get(ref(db, `${path}/pickups`));
        const pickups = snapshot.val();
        if (!pickups) {
          cbk(0); // No pickups means 0 live pickups
          return;
        }
        const live = Object.values(pickups).filter((p: {pickedUp?: boolean}) => !p.pickedUp);
        cbk(live.length);
      } catch (error) {
        logger.errorWithException('Error counting live pickups', error, {path});
        cbk(0); // Return 0 on error
      }
    },

    spawnPowerups: async (path: string, n: number, games: any[], cbk?: () => void) => {
      try {
        const possibleLocationsPerGrid = games.map((game) => {
          const {grid, solution} = game;
          const gridObj = new GridObject(grid);
          return gridObj.getPossiblePickupLocations(solution);
        });

        // Use Promise wrapper to convert callback-based countLivePickups
        const currentNum = await new Promise<number>((resolve) => {
          const state = getState();
          state.countLivePickups(path, resolve);
        });

        if (currentNum > MAX_ON_BOARD) return;

        const possibleLocations = intersectionWith(...possibleLocationsPerGrid, isEqual);
        const locations = sampleSize(possibleLocations, n);
        const powerupTypes = Object.keys(powerupData);
        const pickups = locations.map(({i, j}: {i: number; j: number}) => ({
          i,
          j,
          type: sample(powerupTypes),
        }));

        await Promise.all(pickups.map((pickup) => push(ref(db, `${path}/pickups`), pickup)));

        if (cbk) cbk();
      } catch (error) {
        logger.errorWithException('Error spawning powerups', error, {path, n, gamesCount: games.length});
      }
    },

    initialize: (path: string, pid: number, bid: number, teams: number = 2) => {
      const args = Array.from({length: teams}, (_, team) => ({
        pid,
        battleData: {bid, team},
      }));

      const powerupTypes = Object.keys(powerupData);
      const powerups = Array.from({length: teams}, () =>
        sampleSize(powerupTypes, STARTING_POWERUPS).map((type) => ({type}))
      );

      // Use Zustand puzzleStore instead of EventEmitter PuzzleModel
      const puzzleStore = usePuzzleStore.getState();
      const puzzlePath = `/puzzle/${pid}`;
      puzzleStore.getPuzzle(puzzlePath, pid);
      puzzleStore.attach(puzzlePath);

      // Wait for puzzle to be ready
      puzzleStore.waitForReady(puzzlePath).then(() => {
        const rawGame = puzzleStore.toGame(puzzlePath);
        puzzleStore.detach(puzzlePath);

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
          const state = getState();
          const battle = state.battles[path];
          set(ref(db, `${path}/games`), gids).then(() => {
            set(ref(db, `${path}/powerups`), powerups).then(() => {
              const currentState = getState();
              currentState.spawnPowerups(path, NUM_PICKUPS, [rawGame], () => {
                emit(path, 'ready', undefined);
              });
            });
          });

          setState({
            battles: {
              ...state.battles,
              [path]: {
                ...battle!,
                gids,
              },
            },
          });
        });
      });
    },
  };
});
