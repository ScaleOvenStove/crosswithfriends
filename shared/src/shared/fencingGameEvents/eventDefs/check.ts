import type {CellCoords, GridData} from '../../types';
import type {EventDef} from '../types/EventDef';

export interface CheckEvent {
  scope: CellCoords[];
  id: string;
}

/**
 * Handle the "check" event.
 * Preconditions:
 * - params.scope must be "cell"
 * - team must have filled out the cell with a value
 * - cell must not be "good" already
 * Effects:
 * - Case 1: cell.value is correct
 *   - update state.game.grid[r][c] to be { value, good, teamId }
 *   - update teamGrids[*][r][c].good = true, .teamId = teamId
 * - Case 2: cell is wrong
 *   - update the timeout? (skip this step in MVP)
 *   - update teamGrids[teamId][r][c].bad = true
 */
const check: EventDef<CheckEvent> = {
  reducer(state, {scope, id}) {
    const user = state.users[id];
    if (!user || !user.teamId) {
      return state; // illegal update if no user exists with id
    }
    const teamId = user.teamId;
    if (scope.length !== 1) {
      return state; // illegal update if trying to check more than 1 cell
    }
    const teamGrid = state.game?.teamGrids?.[teamId];
    if (
      !state.game ||
      !teamGrid // illegal update if teamGrid is somehow undefined
    ) {
      return state;
    }
    const cell = scope[0];
    if (!cell) {
      return state; // illegal update if scope is empty
    }
    const {r, c} = cell;
    const cellData = teamGrid[r]?.[c];
    if (
      !cellData || // if cell doesn't exist, cannot check
      cellData.good || // if cell is already correct, no need to update
      !cellData.value // if cell is not filled out, cannot check
    ) {
      return state;
    }

    const updateCellCorrect = (grid: GridData): GridData => {
      const newGrid = [...grid];
      newGrid[r] = [...(grid[r] || [])];
      newGrid[r][c] = {
        ...grid[r]?.[c],
        value: state.game!.solution[r]?.[c],
        bad: false,
        good: true,
        solvedBy: {id, teamId},
      };
      return newGrid;
    };

    const updateCellIncorrect = (grid: GridData): GridData => {
      const newGrid = [...grid];
      newGrid[r] = [...(grid[r] || [])];
      newGrid[r][c] = {
        ...grid[r]?.[c],
        bad: true,
        good: false,
      };
      return newGrid;
    };

    const isCorrect = state.game.solution[r]?.[c] === cellData.value;
    if (isCorrect) {
      return {
        ...state,
        game: {
          ...state.game!,
          teamClueVisibility: {
            ...state.game.teamClueVisibility,
            [teamId]: {
              across: (() => {
                const existing = state.game.teamClueVisibility?.[teamId]?.across || [];
                const newArray = [...existing];
                const clueIndex = cellData.parents?.across ?? 0;
                if (clueIndex >= 0 && clueIndex < newArray.length) {
                  newArray[clueIndex] = true;
                }
                return newArray;
              })(),
              down: (() => {
                const existing = state.game.teamClueVisibility?.[teamId]?.down || [];
                const newArray = [...existing];
                const clueIndex = cellData.parents?.down ?? 0;
                if (clueIndex >= 0 && clueIndex < newArray.length) {
                  newArray[clueIndex] = true;
                }
                return newArray;
              })(),
            },
          },
          teamGrids: Object.fromEntries(
            Object.entries(state.game!.teamGrids ?? {}).map(([tId, tGrid]) => [tId, updateCellCorrect(tGrid)])
          ),
          grid: updateCellCorrect(state.game.grid),
        },
        users: {
          ...state.users,
          [id]: {
            ...user,
            score: (user.score || 0) + 1,
          },
        },
        teams: {
          ...state.teams,
          [teamId]: {
            ...state.teams[teamId],
            score: state.teams[teamId]!.score + 1,
          },
        },
      };
    }
    return {
      ...state,
      game: {
        ...state.game!,
        teamGrids: {
          ...state.game?.teamGrids,
          [teamId]: updateCellIncorrect(teamGrid),
        },
      },
      users: {
        ...state.users,
        [id]: {
          ...user,
          misses: (user.misses || 0) + 1,
        },
      },
      teams: {
        ...state.teams,
        [teamId]: {
          ...state.teams[teamId],
          guesses: state.teams[teamId]!.guesses + 1,
        },
      },
    };
  },
};

export default check;
