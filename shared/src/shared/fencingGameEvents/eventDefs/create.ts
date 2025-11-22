import flatMap from 'lodash-es/flatMap';
import fromPairs from 'lodash-es/fromPairs';
import range from 'lodash-es/range';
import sortBy from 'lodash-es/sortBy';
import type {CellCoords, GameJson} from '../../types';
import type {EventDef} from '../types/EventDef';
import {TEAM_IDS} from '../constants';

export interface CreateEvent {
  pid: string;
  game: GameJson;
}

const create: EventDef<CreateEvent> = {
  reducer(state, params) {
    return {
      ...state,
      loaded: true,
      game: {
        ...state.game,
        pid: params.pid,
        ...params.game,
        teamGrids: fromPairs(TEAM_IDS.map((teamId) => [teamId, params.game.grid])),
        teamClueVisibility: fromPairs(
          TEAM_IDS.map((teamId) => [teamId, getInitialClueVisibility(params.game, teamId)])
        ),
      },
    };
  },
};

export default create;

const getOrigin = (game: GameJson, teamId: number) => {
  const n = game.grid.length;
  const m = game.grid[0]?.length ?? 0;
  const origin = teamId === 1 ? {r: n - 1, c: 0} : {r: 0, c: m - 1};
  return origin;
};

const getSortedWhiteCells = (game: GameJson, origin: CellCoords) => {
  const n = game.grid.length;
  const m = game.grid[0]?.length ?? 0;

  const TIEBREAKER = 1.0001; // this makes the order consistent under 180 rotational symmetry (i.e. don't leave it up to stable sorting to break ties between cells that are equidistant from origin)

  const allWhiteCells = flatMap(range(n).map((r) => range(m).map((c) => ({r, c})))).filter(
    ({r, c}) => !game.grid[r]?.[c]?.black
  );

  const sortedWhiteCells = sortBy(
    allWhiteCells,
    ({r, c}) => Math.abs(r - origin.r) * TIEBREAKER + Math.abs(c - origin.c)
  );
  return sortedWhiteCells;
};

export const getStartingCursorPosition = (game: GameJson, teamId: number) => {
  const origin = getOrigin(game, teamId);
  const sortedWhiteCells = getSortedWhiteCells(game, origin);
  return sortedWhiteCells[0];
};

const getInitialClueVisibility = (
  game: GameJson,
  teamId: number
): {
  across: boolean[];
  down: boolean[];
} => {
  const grid = game.grid;
  const origin = getOrigin(game, teamId);
  const sortedWhiteCells = getSortedWhiteCells(game, origin);
  const MIN_CLUES = 10;
  // take the minimum prefix of sortedWhiteCells so that the number of clues spanned by the cells is at least MIN_CLUES
  const across = game.clues.across.map(() => false);
  const down = game.clues.down.map(() => false);
  let cnt = 0;
  for (const cell of sortedWhiteCells) {
    const cellData = grid[cell.r]?.[cell.c];
    if (!cellData?.parents) continue;
    const p = cellData.parents;
    if (!across[p.across]) {
      cnt += 1;
      across[p.across] = true;
    }
    if (!down[p.down]) {
      cnt += 1;
      down[p.down] = true;
    }
    if (cnt >= MIN_CLUES) break;
  }
  return {
    across,
    down,
  };
};
