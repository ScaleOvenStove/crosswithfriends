import type {CheckEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/check';
import type {RevealEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/reveal';
import type {RevealAllCluesEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/revealAllClues';
import type {SendChatMessageEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/sendChatMessage';
import type {StartEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/startGame';
import type {UpdateCellEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/updateCell';
import type {UpdateCursorEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/updateCursor';
import type {UpdateDisplayNameEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/updateDisplayName';
import type {UpdateTeamIdEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/updateTeamId';
import type {UpdateTeamNameEvent} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/updateTeamName';
import {convertIpuzClues} from '@crosswithfriends/shared/lib/puzzleUtils';
import type {CellIndex, GameJson} from '@crosswithfriends/shared/types';

import {makeGrid} from '../gameUtils.js';
import {logger} from '../utils/logger.js';
import {timestampToISOString} from '../utils/timestamp.js';

import type {
  LegacyAddPingParams,
  LegacyChatParams,
  LegacyCheckParams,
  LegacyResetParams,
  LegacyRevealParams,
  LegacySendChatMessageParams,
  LegacyUpdateCellParams,
  LegacyUpdateClockParams,
  LegacyUpdateColorParams,
  LegacyUpdateCursorParams,
} from './legacyEventTypes.js';
import {pool} from './pool.js';
import {getPuzzle} from './puzzle.js';

export async function getGameEvents(
  gid: string,
  options?: {limit?: number; offset?: number}
): Promise<{events: GameEvent[]; total: number}> {
  const startTime = Date.now();

  let query = 'SELECT event_payload FROM game_events WHERE gid=$1 ORDER BY ts ASC';
  const params: unknown[] = [gid];

  if (options?.limit) {
    query += ' LIMIT $2';
    params.push(options.limit);

    if (options?.offset) {
      query += ' OFFSET $3';
      params.push(options.offset);
    }
  }

  const res = await pool.query(query, params);
  const events = res.rows.map((row) => row.event_payload);

  // Get total count
  const countRes = await pool.query('SELECT COUNT(*) FROM game_events WHERE gid=$1', [gid]);
  const total = parseInt(countRes.rows[0].count, 10);

  const ms = Date.now() - startTime;
  logger.debug(`getGameEvents(${gid}) took ${ms}ms`);

  return {events, total};
}

export async function getGameInfo(gid: string): Promise<GameJson['info']> {
  const res = await pool.query("SELECT event_payload FROM game_events WHERE gid=$1 AND event_type='create'", [
    gid,
  ]);
  if (res.rowCount != 1) {
    logger.warn(`Could not find info for game ${gid}`);
    return {
      title: '',
      author: '',
      copyright: '',
      description: '',
    };
  }

  const info = res.rows[0].event_payload.params.game.info;
  logger.debug(`${gid} game info: ${JSON.stringify(info)}`);
  return info;
}

interface CreateEventParams {
  pid: string;
  version?: number; // Optional for backward compatibility
  game: GameJson;
}

// Union type for all game event types
export type GameEventType =
  | 'create'
  | 'updateCell'
  | 'updateCursor'
  | 'addPing'
  | 'updateDisplayName'
  | 'updateColor'
  | 'updateClock'
  | 'check'
  | 'reveal'
  | 'reset'
  | 'chat'
  | 'sendChatMessage'
  | 'updateTeamName'
  | 'updateTeamId'
  | 'revealAllClues'
  | 'startGame';

// Union type for all game event parameters
export type GameEventParams =
  | CreateEventParams
  | LegacyUpdateCellParams
  | LegacyUpdateCursorParams
  | UpdateCursorEvent
  | LegacyAddPingParams
  | UpdateDisplayNameEvent
  | LegacyUpdateColorParams
  | LegacyUpdateClockParams
  | LegacyCheckParams
  | CheckEvent
  | LegacyRevealParams
  | RevealEvent
  | LegacyResetParams
  | LegacyChatParams
  | LegacySendChatMessageParams
  | SendChatMessageEvent
  | UpdateTeamNameEvent
  | UpdateTeamIdEvent
  | RevealAllCluesEvent
  | StartEvent
  | UpdateCellEvent;

export interface GameEvent {
  user?: string | null; // always null actually
  timestamp: number;
  type: GameEventType;
  params: GameEventParams;
}

export interface InitialGameEvent extends GameEvent {
  type: 'create';
  params: CreateEventParams;
}

export async function addGameEvent(gid: string, event: GameEvent): Promise<void> {
  await pool.query(
    `
      INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
      VALUES ($1, $2, $3, $4, $5)`,
    [gid, event.user, timestampToISOString(event.timestamp), event.type, event]
  );
}

export async function addInitialGameEvent(gid: string, pid: string): Promise<string> {
  const puzzle = await getPuzzle(pid);
  logger.debug({pid}, 'got puzzle');

  // Check if this is old format (has 'grid' field) or new ipuz format (has 'solution' field)
  const isOldFormat = 'grid' in puzzle && Array.isArray((puzzle as {grid?: unknown}).grid);
  const isIpuzFormat = 'solution' in puzzle && Array.isArray(puzzle.solution);

  let solution: string[][];
  let title: string;
  let author: string;
  let copyright: string;
  let description: string;
  let acrossClues: string[];
  let downClues: string[];

  if (isOldFormat) {
    // Handle old format: convert grid to solution
    logger.debug({pid}, 'Converting old format puzzle to ipuz format');
    const oldPuzzle = puzzle as {
      grid?: string[][];
      info?: {title?: string; author?: string; copyright?: string; description?: string; type?: string};
      clues?: {down?: string[]; across?: string[]};
      circles?: number[];
      shades?: number[];
    };

    const grid = oldPuzzle.grid || [];
    if (!grid || grid.length === 0) {
      throw new Error(`Puzzle ${pid} has an empty grid array`);
    }

    // Convert grid to solution: "." stays as "." (already correct format)
    solution = grid.map((row: string[]) => row.map((cell: string) => cell));

    // Extract metadata from info object
    const info = oldPuzzle.info || {};
    title = info.title || '';
    author = info.author || '';
    copyright = info.copyright || '';
    description = info.description || '';

    // Convert clues from old format (sparse arrays) to internal format
    // Old format clues are already sparse arrays indexed by clue number
    acrossClues = oldPuzzle.clues?.across || [];
    downClues = oldPuzzle.clues?.down || [];
  } else if (isIpuzFormat) {
    // Handle ipuz format
    title = puzzle.title || '';
    author = puzzle.author || '';
    copyright = puzzle.copyright || '';
    description = puzzle.notes || '';

    solution = (puzzle.solution || []).map((row: (string | null)[]) =>
      row.map((cell: string | null) => (cell === null ? '.' : cell))
    );

    // Convert ipuz clues format to internal format
    // Supports both v1 format: [["1", "clue text"], ...] and v2 format: [{number: "1", clue: "clue text", cells: [...]}, ...]
    acrossClues = convertIpuzClues(puzzle.clues?.Across || []);
    downClues = convertIpuzClues(puzzle.clues?.Down || []);
  } else {
    // Neither format detected
    logger.error(
      {
        pid,
        puzzleKeys: Object.keys(puzzle),
        hasGrid: 'grid' in puzzle,
        hasSolution: 'solution' in puzzle,
      },
      'Puzzle format not recognized'
    );
    throw new Error(
      `Puzzle ${pid} is in an unrecognized format. Expected either old format (with 'grid' field) or ipuz format (with 'solution' field).`
    );
  }

  // Validate solution is not empty
  if (!solution || solution.length === 0) {
    logger.error(
      {
        pid,
        puzzleKeys: Object.keys(puzzle),
        solutionValue: puzzle.solution,
      },
      'Puzzle has empty solution array'
    );
    throw new Error(
      `Puzzle ${pid} has an empty solution array. This puzzle may be corrupted or in an invalid format. Please re-upload the puzzle with a valid solution.`
    );
  }
  if (!solution[0] || solution[0].length === 0) {
    logger.error(
      {
        pid,
        solutionLength: solution.length,
        firstRowLength: solution[0]?.length,
      },
      'Puzzle has solution with empty rows'
    );
    throw new Error(
      `Puzzle ${pid} has a solution with empty rows. This puzzle may be corrupted or in an invalid format. Please re-upload the puzzle with a valid solution.`
    );
  }

  // Extract circles and shades from puzzle grid
  // For old format: extract from circles/shades arrays
  // For ipuz format: extract from puzzle grid cell styles
  const circles: number[] = [];
  const shades: number[] = [];
  let puzzleGrid: (number | string | import('@crosswithfriends/shared/types').IpuzCell | null)[][] = [];

  if (isOldFormat) {
    // Old format: circles and shades are already in arrays
    const oldPuzzle = puzzle as {circles?: number[]; shades?: number[]};
    circles.push(...(oldPuzzle.circles || []));
    shades.push(...(oldPuzzle.shades || []));

    // Generate puzzle grid from solution using makeGrid
    // This will calculate clue numbers automatically
    const gridObject = makeGrid(solution, false);
    const gridArray = gridObject.toArray();
    const ncol = solution[0]?.length || 0;

    puzzleGrid = gridArray.map((row: import('@crosswithfriends/shared/types').CellData[], rowIndex: number) =>
      row.map((cell: import('@crosswithfriends/shared/types').CellData, cellIndex: number) => {
        const idx = rowIndex * ncol + cellIndex;
        if (cell.black) {
          return '#';
        } else if (cell.number !== undefined && cell.number !== 0) {
          // Check if this cell has a circle
          if (circles.includes(idx)) {
            return {cell: cell.number, style: {shapebg: 'circle'}};
          }
          return cell.number;
        } else {
          return '0';
        }
      })
    );
  } else {
    // Ipuz format: extract from puzzle grid
    puzzleGrid = puzzle.puzzle || [];
    const ncol = solution[0]?.length || 0;
    type IpuzCell = import('@crosswithfriends/shared/types').IpuzCell;
    puzzleGrid.forEach((row: (number | string | IpuzCell | null)[], rowIndex: number) => {
      row.forEach((cell: number | string | IpuzCell | null, cellIndex: number) => {
        if (cell && typeof cell === 'object' && 'cell' in cell) {
          // Cell object with style
          if (cell.style?.shapebg === 'circle') {
            const idx = rowIndex * ncol + cellIndex;
            circles.push(idx);
          }
          if (cell.style?.fillbg) {
            const idx = rowIndex * ncol + cellIndex;
            shades.push(idx);
          }
        }
      });
    });
  }

  const gridObject = makeGrid(solution, false);
  const clues = gridObject.alignClues({across: acrossClues, down: downClues});
  const grid = gridObject.toArray();

  // Validate grid is not empty after creation
  if (!grid || grid.length === 0) {
    throw new Error(`Puzzle ${pid} produced an empty grid after processing`);
  }
  if (!grid[0] || grid[0].length === 0) {
    throw new Error(`Puzzle ${pid} produced a grid with empty rows after processing`);
  }

  // Determine puzzle type from grid size
  const type = solution.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';

  const initialEvent: InitialGameEvent = {
    user: '',
    timestamp: Date.now(),
    type: 'create',
    params: {
      pid,
      version: 1.0,
      game: {
        info: {
          title,
          author,
          copyright,
          description,
          type,
        },
        grid,
        solution,
        clues,
        circles: circles.length > 0 ? (circles as CellIndex[]) : undefined,
        shades: shades.length > 0 ? (shades as CellIndex[]) : undefined,
      },
    },
  };
  await addGameEvent(gid, initialEvent);
  return gid;
}
