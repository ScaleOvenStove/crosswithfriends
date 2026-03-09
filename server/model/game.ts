import _ from 'lodash';
import {makeGrid} from '../gameUtils';
import {pool} from './pool';
import {getPuzzle} from './puzzle';
import {getGameSnapshot} from './game_snapshot';

export async function getGameEvents(gid: string) {
  // Check for a snapshot FIRST — if a non-replay snapshot exists, we only need
  // the create event (1 row) instead of loading the entire event history.
  // This dramatically reduces I/O for solved games which may have thousands of events.
  const snapshot = await getGameSnapshot(gid);
  if (snapshot && !snapshot.replayRetained) {
    // Only fetch the create event — skip all updateCell/check/reveal/chat events
    const createRes = await pool.query(
      "SELECT event_payload FROM game_events WHERE gid=$1 AND event_type='create' ORDER BY ts ASC LIMIT 1",
      [gid]
    );
    if (createRes.rows.length > 0) {
      const createEvent = createRes.rows[0].event_payload;
      const game = createEvent.params.game;
      const snap = snapshot.snapshot as any;
      if (snap.grid) game.grid = snap.grid;
      if (snap.users) game.users = snap.users;
      if (snap.clock) game.clock = snap.clock;
      if (snap.chat) game.chat = snap.chat;
      game.solved = true;
      if (game.contest) game.contestSolved = true;
      return [createEvent];
    }
  }

  // No snapshot or replay retained — load all events
  const res = await pool.query('SELECT event_payload FROM game_events WHERE gid=$1 ORDER BY ts ASC', [gid]);
  return _.map(res.rows, 'event_payload');
}

export async function getGameInfo(gid: string) {
  const res = await pool.query("SELECT event_payload FROM game_events WHERE gid=$1 AND event_type='create'", [
    gid,
  ]);
  if (res.rowCount !== 1) {
    return {};
  }

  return res.rows[0].event_payload.params.game.info;
}

export interface GameEvent {
  user?: string; // always null actually
  timestamp: number;
  type: string; // todo string literal union type
  params: any; // todo extend GameEvent w/ specific types of game events
}

export interface InitialGameEvent extends GameEvent {
  type: 'create';
  params: {
    pid: string;
    version: string;
    game: any;
  };
}

export async function addGameEvent(gid: string, event: GameEvent) {
  // event.user is historically always null; fall back to params.id (the player's dfac_id)
  const uid = event.user || event.params?.id || null;
  await pool.query(
    `
      INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
      VALUES ($1, $2, $3, $4, $5)`,
    [gid, uid, new Date(event.timestamp).toISOString(), event.type, event]
  );
}

export async function addInitialGameEvent(gid: string, pid: string) {
  const puzzle = await getPuzzle(pid);
  if (!puzzle) throw new Error(`Puzzle not found: ${pid}`);
  const {
    info = {},
    grid: solution = [['']],
    circles = [],
    shades = [],
    images = {},
    contest = false,
  } = puzzle;

  const gridObject = makeGrid(solution, images);
  const clues = gridObject.alignClues(puzzle.clues);
  const grid = gridObject.toArray();

  const initialEvent = {
    user: '',
    timestamp: Date.now(),
    type: 'create',
    params: {
      pid,
      version: 1.0,
      game: {
        info,
        grid,
        solution,
        circles,
        shades,
        ...(Object.keys(images).length > 0 ? {images} : {}),
        ...(contest ? {contest} : {}),
        chat: {messages: []},
        cursor: {},
        clock: {
          lastUpdated: 0,
          totalTime: 0,
          trueTotalTime: 0,
          paused: true,
        },
        solved: false,
        clues,
      },
    },
  };
  await addGameEvent(gid, initialEvent);
  return gid;
}
