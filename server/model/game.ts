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

import {pool} from './pool.js';
import {getPuzzle} from './puzzle.js';

export async function getGameEvents(gid: string): Promise<GameEvent[]> {
  const startTime = Date.now();
  const res = await pool.query('SELECT event_payload FROM game_events WHERE gid=$1 ORDER BY ts ASC', [gid]);
  const events = res.rows.map((row) => row.event_payload);
  const ms = Date.now() - startTime;
  logger.debug(`getGameEvents(${gid}) took ${ms}ms`);
  return events;
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

// Legacy event parameter types (from gameStore.ts)
interface LegacyUpdateCellParams {
  cell: {r: number; c: number};
  value: string;
  color: string;
  pencil: boolean;
  id: string;
  autocheck: boolean;
}

interface LegacyUpdateCursorParams {
  timestamp: number;
  cell: {r: number; c: number};
  id: string;
}

interface LegacyAddPingParams {
  timestamp: number;
  cell: {r: number; c: number};
  id: string;
}

interface LegacyUpdateColorParams {
  id: string;
  color: string;
}

interface LegacyUpdateClockParams {
  action: string;
  timestamp: number;
}

interface LegacyCheckParams {
  scope: string | {r: number; c: number}[]; // Can be string or array
}

interface LegacyRevealParams {
  scope: string | {r: number; c: number}[]; // Can be string or array
}

interface LegacyResetParams {
  scope: string | {r: number; c: number}[]; // Can be string or array
  force: boolean;
}

interface LegacyChatParams {
  text: string;
  senderId: string;
  sender: string;
}

interface LegacySendChatMessageParams {
  message: string;
  id: string;
  sender: string;
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

/**
 * Safely converts a timestamp to an ISO string.
 * If the timestamp is invalid, falls back to the current time and logs a warning.
 */
function timestampToISOString(timestamp: number | undefined | null): string {
  // Check if timestamp is a valid number
  if (timestamp == null || typeof timestamp !== 'number' || isNaN(timestamp)) {
    logger.warn(
      {timestamp, fallbackTo: Date.now()},
      'Invalid timestamp provided, using current time as fallback'
    );
    return new Date().toISOString();
  }

  // Create Date object and check if it's valid
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    logger.warn(
      {timestamp, fallbackTo: Date.now()},
      'Invalid Date created from timestamp, using current time as fallback'
    );
    return new Date().toISOString();
  }

  return date.toISOString();
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

  // Read from ipuz format
  const title = puzzle.title || '';
  const author = puzzle.author || '';
  const copyright = puzzle.copyright || '';
  const description = puzzle.notes || '';
  const solution = (puzzle.solution || []).map((row: (string | null)[]) =>
    row.map((cell: string | null) => (cell === null ? '.' : cell))
  );

  // Validate solution is not empty
  if (!solution || solution.length === 0) {
    throw new Error(`Puzzle ${pid} has an empty solution array`);
  }
  if (!solution[0] || solution[0].length === 0) {
    throw new Error(`Puzzle ${pid} has a solution with empty rows`);
  }

  // Extract circles and shades from puzzle grid
  // ipuz format: puzzle grid can contain numbers, "#", objects with {cell, style}, or null
  const circles: number[] = [];
  const shades: number[] = [];
  const puzzleGrid = puzzle.puzzle || [];
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

  // Convert ipuz clues format to internal format
  // Supports both v1 format: [["1", "clue text"], ...] and v2 format: [{number: "1", clue: "clue text", cells: [...]}, ...]
  const acrossClues = convertIpuzClues(puzzle.clues?.Across || []);
  const downClues = convertIpuzClues(puzzle.clues?.Down || []);

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
