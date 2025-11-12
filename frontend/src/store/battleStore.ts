import {create} from 'zustand';
import _ from 'lodash';
import {db, type DatabaseReference} from './firebase';
import {ref, onValue, get, set, push, remove, runTransaction} from 'firebase/database';
// eslint-disable-next-line import/no-cycle
import actions from '../actions';

import powerupData from '@crosswithfriends/shared/lib/powerups';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
// eslint-disable-next-line import/no-cycle
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
  checkPickups: (path: string, r: number, c: number, game: any, team: number) => void;
  countLivePickups: (path: string, cbk: (count: number) => void) => void;
  spawnPowerups: (path: string, n: number, games: any[], cbk?: () => void) => void;
  initialize: (path: string, pid: number, bid: number, teams?: number) => void;
  subscribe: (path: string, event: string, callback: (...args: any[]) => void) => () => void;
  once: (path: string, event: string, callback: (...args: any[]) => void) => () => void; // Subscribe once, auto-unsubscribe after first call
}

export const useBattleStore = create<BattleStore>((setState, getState) => {
  // Helper function to emit events to subscribers
  const emit = (path: string, event: string, data: unknown): void => {
    const state = getState();
    const battle = state.battles[path];
    if (!battle) return;
    
    const subscribers = battle.subscriptions.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscription callback for ${event}:`, error);
        }
      });
    }
  };

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
        console.error('Failed to get battle instance for path:', path);
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

      Object.values(battle.unsubscribes).forEach((unsubscribe) => unsubscribe());

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

    subscribe: (path: string, event: string, callback: (data: unknown) => void) => {
      const state = getState();
      const battle = state.battles[path];
      if (!battle) return () => {};

      // Get or create subscription set for this event
      if (!battle.subscriptions.has(event)) {
        battle.subscriptions.set(event, new Set());
      }
      const subscribers = battle.subscriptions.get(event)!;
      
      // Add callback to subscribers
      subscribers.add(callback);

      // Return unsubscribe function
      return () => {
        const currentState = getState();
        const currentBattle = currentState.battles[path];
        if (!currentBattle) return;

        const currentSubscribers = currentBattle.subscriptions.get(event);
        if (currentSubscribers) {
          currentSubscribers.delete(callback);
          // Clean up empty sets
          if (currentSubscribers.size === 0) {
            currentBattle.subscriptions.delete(event);
          }
        }
      };
    },

    once: (path: string, event: string, callback: (data: unknown) => void) => {
      const state = getState();
      const battle = state.battles[path];
      if (!battle) return () => {};

      // Wrap callback to auto-unsubscribe after first call
      let called = false;
      const wrappedCallback = (data: unknown) => {
        if (!called) {
          called = true;
          callback(data);
          // Auto-unsubscribe
          const currentState = getState();
          const currentBattle = currentState.battles[path];
          if (currentBattle) {
            const subscribers = currentBattle.subscriptions.get(event);
            if (subscribers) {
              subscribers.delete(wrappedCallback);
              if (subscribers.size === 0) {
                currentBattle.subscriptions.delete(event);
              }
            }
          }
        }
      };

      // Get or create subscription set for this event
      if (!battle.subscriptions.has(event)) {
        battle.subscriptions.set(event, new Set());
      }
      const subscribers = battle.subscriptions.get(event)!;
      subscribers.add(wrappedCallback);

      // Return unsubscribe function
      return () => {
        const currentState = getState();
        const currentBattle = currentState.battles[path];
        if (!currentBattle) return;

        const currentSubscribers = currentBattle.subscriptions.get(event);
        if (currentSubscribers) {
          currentSubscribers.delete(wrappedCallback);
          if (currentSubscribers.size === 0) {
            currentBattle.subscriptions.delete(event);
          }
        }
      };
    },

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

    removePlayer: (path: string, name: string, team: number) => {
      get(ref(db, `${path}/players`)).then((snapshot) => {
        const players = snapshot.val();
        const playerToRemove = _.findKey(players, {name, team});
        if (playerToRemove) {
          remove(ref(db, `${path}/players/${playerToRemove}`));
        }
      });
    },

    usePowerup: (path: string, type: string, team: number) => {
      get(ref(db, `${path}/powerups`)).then((snapshot) => {
        const allPowerups = snapshot.val();
        const ownPowerups = allPowerups[team];
        const toUse = _.find(ownPowerups, (powerup: any) => powerup.type === type && !powerup.used);
        if (toUse) {
          emit(path, 'usePowerup', toUse);
          toUse.used = Date.now();
          toUse.target = 1 - team; // For now use on other team.
          set(ref(db, `${path}/powerups`), allPowerups);
        }
      });
    },

    checkPickups: (path: string, r: number, c: number, game: {grid: unknown[][]; solution: string[][]}, team: number) => {
      const {grid, solution} = game;
      const gridObj = new GridObject(grid);

      // Use transactions to atomically update both pickups and powerups
      // First, get the current state to determine what needs to be updated
      Promise.all([get(ref(db, `${path}/pickups`)), get(ref(db, `${path}/powerups`))]).then(
        ([pickupsSnapshot]) => {
          const pickups = (pickupsSnapshot.val() || {}) as Record<string, {pickedUp?: boolean; type: string; i: number; j: number}>;

          const {across, down} = gridObj.getCrossingWords(r, c);
          const cellsToCheck = [...across, ...down];

          // Determine which pickups should be collected
          const pickupsToMark: string[] = [];
          const powerupsToAdd: Array<{type: string}> = [];

          cellsToCheck.forEach(({i, j}: {i: number; j: number}) => {
            const gridCell = grid[i]?.[j] as {value?: string} | undefined;
            const solutionCell = solution[i]?.[j];
            if (!gridCell || gridCell.value !== solutionCell) return;

            _.forEach(pickups, (pickup, key: string) => {
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

    countLivePickups: (path: string, cbk: (count: number) => void) => {
      get(ref(db, `${path}/pickups`)).then((snapshot) => {
        const pickups = snapshot.val();
        const live = _.filter(pickups, (p: any) => !p.pickedUp);
        cbk(live.length);
      });
    },

    spawnPowerups: (path: string, n: number, games: any[], cbk?: () => void) => {
      const possibleLocationsPerGrid = _.map(games, (game) => {
        const {grid, solution} = game;
        const gridObj = new GridObject(grid);
        return gridObj.getPossiblePickupLocations(solution);
      });

      const state = getState();
      state.countLivePickups(path, (currentNum) => {
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
            return push(ref(db, `${path}/pickups`), pickup).then(() => {});
          })
        ).then(() => {
          if (cbk) cbk();
        });
      });
    },

    initialize: (path: string, pid: number, bid: number, teams: number = 2) => {
      const args = _.map(_.range(teams), (team) => ({
        pid,
        battleData: {bid, team},
      }));

      const powerupTypes = _.keys(powerupData);
      const powerups = _.map(_.range(teams), () =>
        _.map(_.sampleSize(powerupTypes, STARTING_POWERUPS), (type) => ({type}))
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
