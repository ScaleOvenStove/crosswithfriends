import type {CellCoords} from '../../types';
import type {EventDef} from '../types/EventDef';

export interface UpdateCellEvent {
  cell: CellCoords;
  value: string;
  autocheck: boolean;
  id: string;
}

/**
 * Handle the "updateCell" event.
 * Preconditions:
 * - user must be on a team
 * - game must not be complete
 * - cell must be writable
 *   i. must not be checked-correct
 *   ii. must be visible by team
 * Effects:
 * - updates state.game.teamGrids[teamId][r][c].value = value
 */
const updateCell: EventDef<UpdateCellEvent> = {
  reducer(state, {cell, value, id}) {
    const teamId = state.users[id]?.teamId;
    if (!teamId || !(teamId in state.teams)) {
      return state; // illegal update if no user exists with id
    }
    const {r, c} = cell;

    const grid = state.game?.teamGrids?.[teamId];
    if (!grid) {
      return state; // illegal update if grid is somehow undefined
    }
    if (grid[r]?.[c]?.good) {
      return state; // if cell is already correct, no need to update
    }

    const newGrid = [...grid];
    const gridRow = grid[r];
    if (!gridRow) {
      return state; // illegal update if row is undefined
    }
    newGrid[r] = [...gridRow];
    newGrid[r][c] = {
      ...gridRow[c],
      value,
      bad: false,
    };
    return {
      ...state,
      game: {
        ...state.game!,
        teamGrids: {
          ...state.game?.teamGrids,
          [teamId]: newGrid,
        },
      },
    };
  },
};

export default updateCell;
