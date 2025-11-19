import type {CheckEvent} from '@shared/fencingGameEvents/eventDefs/check';
import type {RevealEvent} from '@shared/fencingGameEvents/eventDefs/reveal';
import type {RevealAllCluesEvent} from '@shared/fencingGameEvents/eventDefs/revealAllClues';
import type {SendChatMessageEvent} from '@shared/fencingGameEvents/eventDefs/sendChatMessage';
import type {StartEvent} from '@shared/fencingGameEvents/eventDefs/startGame';
import type {UpdateCellEvent} from '@shared/fencingGameEvents/eventDefs/updateCell';
import type {UpdateCursorEvent} from '@shared/fencingGameEvents/eventDefs/updateCursor';
import type {UpdateDisplayNameEvent} from '@shared/fencingGameEvents/eventDefs/updateDisplayName';
import type {UpdateTeamIdEvent} from '@shared/fencingGameEvents/eventDefs/updateTeamId';
import type {UpdateTeamNameEvent} from '@shared/fencingGameEvents/eventDefs/updateTeamName';
import type {CellIndex, GameJson} from '@shared/types';
import _ from 'lodash';

import {makeGrid} from '../gameUtils.js';
import {logger} from '../utils/logger.js';

import {pool} from './pool.js';
import {getPuzzle} from './puzzle.js';

export async function getGameEvents(gid: string): Promise<GameEvent[]> {
  const startTime = Date.now();
  const res = await pool.query('SELECT event_payload FROM game_events WHERE gid=$1 ORDER BY ts ASC', [gid]);
  const events = _.map(res.rows, 'event_payload');
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

export async function addGameEvent(gid: string, event: GameEvent): Promise<void> {
  await pool.query(
    `
      INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
      VALUES ($1, $2, $3, $4, $5)`,
    [gid, event.user, new Date(event.timestamp).toISOString(), event.type, event]
  );
}

export async function addInitialGameEvent(gid: string, pid: string): Promise<string> {
  const puzzle = await getPuzzle(pid);
  logger.debug('got puzzle', puzzle);
  
  // Read from ipuz format
  const title = puzzle.title || '';
  const author = puzzle.author || '';
  const copyright = puzzle.copyright || '';
  const description = puzzle.notes || '';
  const solution = (puzzle.solution || []).map((row: (string | null)[]) =>
    row.map((cell: string | null) => (cell === null ? '.' : cell))
  );
  
  // Extract circles from puzzle grid (ipuz format stores circles in puzzle[i][j].style.shapebg)
  const circles: number[] = [];
  const puzzleGrid = puzzle.puzzle || [];
  const ncol = solution[0]?.length || 0;
  puzzleGrid.forEach((row: (import('@shared/types').IpuzCell | null)[], rowIndex: number) => {
    row.forEach((cell: import('@shared/types').IpuzCell | null, cellIndex: number) => {
      if (cell && typeof cell === 'object' && cell.style?.shapebg === 'circle') {
        const idx = rowIndex * ncol + cellIndex;
        circles.push(idx);
      }
    });
  });

  // Extract shades from puzzle grid
  const shades: number[] = [];
  puzzleGrid.forEach((row: (import('@shared/types').IpuzCell | null)[], rowIndex: number) => {
    row.forEach((cell: import('@shared/types').IpuzCell | null, cellIndex: number) => {
      if (cell && typeof cell === 'object' && cell.style?.fillbg) {
        const idx = rowIndex * ncol + cellIndex;
        shades.push(idx);
      }
    });
  });

  // Convert ipuz clues format to internal format
  // ipuz has clues.Across and clues.Down as arrays of [number, clue] or {number, clue}
  const convertClues = (clueArray: Array<[string, string] | {number: string; clue: string}>): string[] => {
    const result: string[] = [];
    clueArray.forEach((item) => {
      if (Array.isArray(item) && item.length >= 2) {
        const num = parseInt(item[0], 10);
        if (!isNaN(num)) {
          result[num] = item[1];
        }
      } else if (item && typeof item === 'object' && 'number' in item && 'clue' in item) {
        const num = parseInt(item.number, 10);
        if (!isNaN(num)) {
          result[num] = item.clue;
        }
      }
    });
    return result;
  };

  const acrossClues = convertClues(puzzle.clues?.Across || []);
  const downClues = convertClues(puzzle.clues?.Down || []);

  const gridObject = makeGrid(solution);
  const clues = gridObject.alignClues({across: acrossClues, down: downClues});
  const grid = gridObject.toArray();

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
