import type {CellCoords, GridData} from '../../types';
import type {EventDef} from '../types/EventDef';

export interface RevealEvent {
  scope: CellCoords[];
  id: string;
}

const reveal: EventDef<RevealEvent> = {
  reducer(state, {scope, id}) {
    const user = state.users[id];
    if (!user || !user.teamId) {
      return state; // illegal update if no user exists with id
    }
    const teamId = user.teamId;
    if (scope.length !== 1 || !scope[0]) {
      return state; // illegal update if trying to check more than 1 cell
    }
    const teamGrid = state.game?.teamGrids?.[teamId];
    if (
      !state.game ||
      !teamGrid // illegal update if teamGrid is somehow undefined
    ) {
      return state;
    }
    const [{r, c}] = scope;
    if (
      teamGrid[r]?.[c]?.good // if cell is already correct, no need to update
    ) {
      return state;
    }

    const updateCellCorrect = (grid: GridData): GridData => {
      const newGrid = [...grid];
      const gridRow = grid[r];
      if (!gridRow) {
        return grid; // Return unchanged if row is undefined
      }
      newGrid[r] = [...gridRow];
      newGrid[r][c] = {
        ...gridRow[c],
        value: state.game!.solution[r]?.[c] ?? '',
        bad: false,
        good: true,
        revealed: true,
        solvedBy: {id, teamId},
      };
      return newGrid;
    };

    return {
      ...state,
      game: {
        ...state.game!,
        teamClueVisibility: {
          ...state.game.teamClueVisibility,
          [teamId]: {
            across: (() => {
              const existing = state.game.teamClueVisibility?.[teamId]?.across ?? [];
              const newArray = [...existing];
              newArray[teamGrid[r]?.[c]?.parents?.across ?? 0] = true;
              return newArray;
            })(),
            down: (() => {
              const existing = state.game.teamClueVisibility?.[teamId]?.down ?? [];
              const newArray = [...existing];
              newArray[teamGrid[r]?.[c]?.parents?.down ?? 0] = true;
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
  },
};

export default reveal;
