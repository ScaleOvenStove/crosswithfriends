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
import type {CellIndex, GameJson} from '@crosswithfriends/shared/types';

import {convertPuzzleToGameFormat} from '../services/PuzzleFormatConverter.js';
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

  // Use COUNT(*) OVER() window function to get total in a single query
  let query = `
    SELECT 
      event_payload,
      COUNT(*) OVER() as total
    FROM game_events 
    WHERE gid=$1 
    ORDER BY ts ASC
  `;
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
  const events = res.rows.map((row) => row.event_payload).filter((payload) => payload !== undefined);
  const total =
    res.rows.length > 0 && res.rows[0].total !== undefined ? parseInt(String(res.rows[0].total), 10) : 0;

  const ms = Date.now() - startTime;
  logger.debug(`getGameEvents(${gid}) took ${ms}ms`);

  return {events, total};
}

export async function getGameInfo(gid: string): Promise<GameJson['info']> {
  const res = await pool.query("SELECT event_payload FROM game_events WHERE gid=$1 AND event_type='create'", [
    gid,
  ]);
  if (res.rowCount != 1 || !res.rows[0]?.event_payload) {
    logger.warn(`Could not find info for game ${gid}`);
    return {
      title: '',
      author: '',
      copyright: '',
      description: '',
    };
  }

  const eventPayload = res.rows[0].event_payload;
  const info = eventPayload?.params?.game?.info;
  if (!info) {
    logger.warn(`Game ${gid} has no info in create event`);
    return {
      title: '',
      author: '',
      copyright: '',
      description: '',
    };
  }

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

export async function addInitialGameEvent(gid: string, pid: string, userId?: string | null): Promise<string> {
  const puzzle = await getPuzzle(pid);
  logger.debug({pid}, 'got puzzle');

  // Use centralized format converter
  const converted = convertPuzzleToGameFormat(puzzle, pid);

  const initialEvent: InitialGameEvent = {
    user: userId || null,
    timestamp: Date.now(),
    type: 'create',
    params: {
      pid,
      version: 1.0,
      game: {
        info: {
          title: converted.title,
          author: converted.author,
          copyright: converted.copyright,
          description: converted.description,
          type: converted.type,
        },
        grid: converted.grid,
        solution: converted.solution,
        clues: converted.clues,
        circles: converted.circles.length > 0 ? (converted.circles as CellIndex[]) : undefined,
        shades: converted.shades.length > 0 ? (converted.shades as CellIndex[]) : undefined,
      },
    },
  };
  await addGameEvent(gid, initialEvent);
  return gid;
}
