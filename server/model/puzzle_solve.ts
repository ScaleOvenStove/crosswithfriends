import moment from 'moment';
import {PuzzleJson} from '@shared/types';
import {pool} from './pool';

export type UserSolveHistoryItem = {
  pid: string;
  gid: string;
  title: string;
  size: string;
  time: number;
  solvedAt: string;
  playerCount: number;
  coSolvers: {userId: string; displayName: string}[];
  anonCount: number;
};

export type SizeStats = {
  size: string;
  count: number;
  avgTime: number;
};

export async function getUserSolveStats(
  userId: string
): Promise<{totalSolved: number; bySize: SizeStats[]; history: UserSolveHistoryItem[]}> {
  // Summary stats by grid size — count distinct puzzles, use best time per puzzle for avg
  const statsResult = await pool.query(
    `SELECT size, COUNT(*)::int AS count, ROUND(AVG(best_time))::int AS avg_time
     FROM (
       SELECT DISTINCT ON (ps.pid)
         ps.pid,
         ps.time_taken_to_solve AS best_time,
         GREATEST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
           || 'x' ||
         LEAST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
           AS size
       FROM puzzle_solves ps
       JOIN puzzles p ON ps.pid = p.pid
       WHERE ps.user_id = $1
       ORDER BY ps.pid, ps.time_taken_to_solve ASC
     ) best_solves
     GROUP BY size
     ORDER BY count DESC`,
    [userId]
  );

  const totalSolved = statsResult.rows.reduce((sum: number, r: any) => sum + r.count, 0);
  const bySize: SizeStats[] = statsResult.rows.map((r: any) => ({
    size: r.size,
    count: r.count,
    avgTime: r.avg_time,
  }));

  // Recent solve history with puzzle info
  const historyResult = await pool.query(
    `SELECT
       ps.pid, ps.gid, ps.time_taken_to_solve, ps.solved_time, ps.player_count,
       p.content->'info'->>'title' AS title,
       GREATEST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
         || 'x' ||
       LEAST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
         AS size
     FROM puzzle_solves ps
     JOIN puzzles p ON ps.pid = p.pid
     WHERE ps.user_id = $1
     ORDER BY ps.solved_time DESC
     LIMIT 100`,
    [userId]
  );

  // For collaborative solves, find co-solvers
  const collabGids = historyResult.rows.filter((r: any) => r.player_count > 1).map((r: any) => r.gid);

  const coSolverMap: Map<string, {userId: string; displayName: string}[]> = new Map();
  const solverCountMap: Map<string, number> = new Map();

  if (collabGids.length > 0) {
    const coSolverResult = await pool.query(
      `SELECT ps.gid, ps.user_id, u.display_name
       FROM puzzle_solves ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.gid = ANY($1) AND ps.user_id IS NOT NULL AND ps.user_id != $2`,
      [collabGids, userId]
    );
    for (const row of coSolverResult.rows) {
      const list = coSolverMap.get(row.gid) || [];
      list.push({userId: row.user_id, displayName: row.display_name});
      coSolverMap.set(row.gid, list);
    }

    // Count total authenticated solvers per gid (including the requesting user)
    const countResult = await pool.query(
      `SELECT gid, COUNT(*)::int AS solver_count
       FROM puzzle_solves
       WHERE gid = ANY($1) AND user_id IS NOT NULL
       GROUP BY gid`,
      [collabGids]
    );
    for (const row of countResult.rows) {
      solverCountMap.set(row.gid, row.solver_count);
    }
  }

  const history: UserSolveHistoryItem[] = historyResult.rows.map((r: any) => {
    const pc = r.player_count || 1;
    const authenticatedCount = solverCountMap.get(r.gid) || 1;
    return {
      pid: r.pid,
      gid: r.gid,
      title: r.title || 'Untitled',
      size: r.size,
      time: Number(r.time_taken_to_solve),
      solvedAt: r.solved_time ? r.solved_time.toISOString() : '',
      playerCount: pc,
      coSolvers: coSolverMap.get(r.gid) || [],
      anonCount: Math.max(0, pc - authenticatedCount),
    };
  });

  return {totalSolved, bySize, history};
}

export type InProgressGameItem = {
  gid: string;
  pid: string;
  title: string;
  size: string;
  lastActivity: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getInProgressGames(userId: string): Promise<InProgressGameItem[]> {
  // Disabled: game_events table scans are too expensive without a game_participants table.
  // TODO: re-enable once game_participants is implemented.
  return [];
}

export async function backfillSolvesForDfacId(userId: string, dfacId: string): Promise<number> {
  const startTime = Date.now();
  // Find anonymous puzzle_solves for games where this dfac_id participated
  const result = await pool.query(
    `INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
     SELECT ps.pid, ps.gid, ps.solved_time, ps.time_taken_to_solve, $1, ps.player_count
     FROM puzzle_solves ps
     WHERE ps.user_id IS NULL
       AND ps.gid IN (
         SELECT gid FROM game_events WHERE uid = $2
         UNION
         SELECT gid FROM game_events WHERE event_payload->'params'->>'id' = $2
       )
     ON CONFLICT DO NOTHING`,
    [userId, dfacId]
  );
  const count = result.rowCount || 0;
  const ms = Date.now() - startTime;
  console.log(`backfillSolvesForDfacId(${userId}, ${dfacId}) backfilled ${count} solves in ${ms}ms`);
  return count;
}

export type SolvedPuzzleType = {
  pid: string;
  gid: string;
  solved_time: moment.Moment;
  time_taken_to_solve: number;
  revealed_squares_count: number;
  checked_squares_count: number;
  title: string;
  size: string;
};

type RawFetchedPuzzleSolve = {
  pid: string;
  gid: string;
  content: PuzzleJson;
  solved_time: moment.Moment;
  time_taken_to_solve: number;
  event_type?: string;
  event_payload?: {
    params?: {scope?: {r: number; c: number}[]};
  };
};

export async function getPuzzleSolves(gids: string[]): Promise<SolvedPuzzleType[]> {
  const startTime = Date.now();
  const {rows}: {rows: RawFetchedPuzzleSolve[]} = await pool.query(
    `
      SELECT
        p.content,
        ps.pid,
        ps.gid,
        ps.solved_time,
        ps.time_taken_to_solve,
        ge.event_type,
        ge.event_payload
      FROM puzzle_solves ps
      JOIN puzzles p on ps.pid = p.pid
      LEFT JOIN game_events ge
        ON ps.gid = ge.gid AND ge.event_type IN ('check', 'reveal')
      WHERE ps.gid = ANY($1)
    `,
    [gids]
  );
  const puzzleIds = new Map<string, RawFetchedPuzzleSolve>();
  const revealedSquareByPuzzle = new Map<string, Set<string>>();
  const checkedSquareByPuzzle = new Map<string, Set<string>>();
  rows.forEach((row) => {
    if (!puzzleIds.has(row.pid)) {
      puzzleIds.set(row.pid, row);
    }
    const cells: string[] = row.event_payload?.params?.scope?.map((c) => JSON.stringify(c)) || [];

    if (row.event_type === 'reveal') {
      const revealedSquares = revealedSquareByPuzzle.get(row.pid) || new Set();
      cells.forEach(revealedSquares.add, revealedSquares);
      revealedSquareByPuzzle.set(row.pid, revealedSquares);
    } else if (row.event_type === 'check') {
      const checkedSquares = checkedSquareByPuzzle.get(row.pid) || new Set();
      cells.forEach(checkedSquares.add, checkedSquares);
      checkedSquareByPuzzle.set(row.pid, checkedSquares);
    }
  });

  const puzzleSolves = Array.from(puzzleIds)
    .map(([pid, puzzle]) => {
      const title = puzzle.content.info.title;
      const grid = puzzle.content.grid;
      const width = grid.length;
      const length = grid.length > 0 ? grid[0].length : 0;
      return {
        pid,
        gid: puzzle.gid,
        title,
        size: `${width}x${length}`,
        solved_time: moment(puzzle.solved_time, 'YYYY-MM-DD'),
        time_taken_to_solve: Number(puzzle.time_taken_to_solve),
        revealed_squares_count: (revealedSquareByPuzzle.get(puzzle.pid) || new Set()).size,
        checked_squares_count: (checkedSquareByPuzzle.get(puzzle.pid) || new Set()).size,
      };
    })
    .sort((a, b) => b.solved_time.utc().valueOf() - a.solved_time.utc().valueOf());
  const ms = Date.now() - startTime;
  console.log(`getPuzzleSolves took ${ms}ms for ${gids.length} gids`);
  return puzzleSolves;
}
