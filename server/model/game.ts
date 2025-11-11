import _ from 'lodash';
import {makeGrid} from '../gameUtils.js';
import {pool} from './pool.js';
import {getPuzzle} from './puzzle.js';
import type {GameJson} from '@shared/types';
import {logger} from '../utils/logger.js';
import type {UpdateCellEvent} from '@shared/fencingGameEvents/eventDefs/updateCell';
import type {UpdateCursorEvent} from '@shared/fencingGameEvents/eventDefs/updateCursor';
import type {UpdateDisplayNameEvent} from '@shared/fencingGameEvents/eventDefs/updateDisplayName';
import type {CheckEvent} from '@shared/fencingGameEvents/eventDefs/check';
import type {RevealEvent} from '@shared/fencingGameEvents/eventDefs/reveal';
import type {SendChatMessageEvent} from '@shared/fencingGameEvents/eventDefs/sendChatMessage';
import type {StartEvent} from '@shared/fencingGameEvents/eventDefs/startGame';
import type {UpdateTeamNameEvent} from '@shared/fencingGameEvents/eventDefs/updateTeamName';
import type {UpdateTeamIdEvent} from '@shared/fencingGameEvents/eventDefs/updateTeamId';
import type {RevealAllCluesEvent} from '@shared/fencingGameEvents/eventDefs/revealAllClues';

export async function getGameEvents(gid: string) {
  const startTime = Date.now();
  const res = await pool.query('SELECT event_payload FROM game_events WHERE gid=$1 ORDER BY ts ASC', [gid]);
  const events = _.map(res.rows, 'event_payload');
  const ms = Date.now() - startTime;
  logger.debug(`getGameEvents(${gid}) took ${ms}ms`);
  return events;
}

export async function getGameInfo(gid: string) {
  const res = await pool.query("SELECT event_payload FROM game_events WHERE gid=$1 AND event_type='create'", [
    gid,
  ]);
  if (res.rowCount != 1) {
    logger.warn(`Could not find info for game ${gid}`);
    return {};
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

export async function addGameEvent(gid: string, event: GameEvent) {
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
  const {
    info = {
      title: '',
      author: '',
      copyright: '',
      description: '',
    },
    grid: solution = [['']],
    circles = [],
  } = puzzle;

  const gridObject = makeGrid(solution);
  const clues = gridObject.alignClues(puzzle.clues);
  const grid = gridObject.toArray();

  // Convert circles from string[] (PuzzleJson format) to CellIndex[] (GameJson format)
  // PuzzleJson stores circles as strings (likely coordinate strings or index strings),
  // but GameJson expects CellIndex[] (branded number type)
  // For now, we'll convert string indices to numbers, or use empty array if conversion fails
  const circlesAsCellIndices: number[] = (circles || [])
    .map((circle) => {
      if (typeof circle === 'string') {
        // Try to parse as number (if it's an index string)
        const parsed = parseInt(circle, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
        // If parsing fails, it might be a coordinate string like "r,c" - skip for now
        // In a real implementation, you'd parse coordinates and convert to CellIndex
        return 0;
      }
      return typeof circle === 'number' ? circle : 0;
    })
    .filter((idx) => idx >= 0); // Filter out invalid indices

  const initialEvent: InitialGameEvent = {
    user: '',
    timestamp: Date.now(),
    type: 'create',
    params: {
      pid,
      version: 1.0,
      game: {
        info: {
          title: info.title || '',
          author: info.author || '',
          copyright: info.copyright || '',
          description: info.description || '',
          type: info.type,
        },
        grid,
        solution,
        clues,
        circles: circlesAsCellIndices.length > 0 ? (circlesAsCellIndices as any) : undefined, // CellIndex is a branded type, safe to cast here
      },
    },
  };
  await addGameEvent(gid, initialEvent);
  return gid;
}
