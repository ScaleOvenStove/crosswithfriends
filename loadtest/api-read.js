// Load test: read-heavy API endpoints.
//
// These are the endpoints most likely to cause DB pressure under load:
//   - GET /api/puzzle_list  (complex SQL with trigram search, filters, joins)
//   - POST /api/game-progress (replays game events to compute %)
//   - GET /api/user-stats/:userId (aggregation queries across puzzle_solves)
//   - GET /api/game-snapshot/:gid
//   - GET /api/puzzle/:pid/info

import http from 'k6/http';
import {check, sleep} from 'k6';
import {Rate, Trend} from 'k6/metrics';
import {BASE_URL, defaultThresholds, getStages} from './config.js';

// Custom metrics per endpoint so you can pinpoint which one is slow.
const puzzleListDuration = new Trend('puzzle_list_duration', true);
const gameProgressDuration = new Trend('game_progress_duration', true);
const puzzleInfoDuration = new Trend('puzzle_info_duration', true);
const errorRate = new Rate('errors');

export const options = {
  stages: getStages(),
  thresholds: {
    ...defaultThresholds,
    puzzle_list_duration: ['p(95)<800'], // allow more for this heavy query
    game_progress_duration: ['p(95)<600'],
    puzzle_info_duration: ['p(95)<250'],
  },
};

export default function () {
  // --- Puzzle list (the most common page load query) ---
  {
    const url =
      `${BASE_URL}/api/puzzle_list?page=0&pageSize=20` +
      `&filter[sizeFilter][Mini]=false&filter[sizeFilter][Standard]=true` +
      `&filter[typeFilter][Standard]=true`;
    const res = http.get(url, {tags: {name: 'GET /api/puzzle_list'}});
    puzzleListDuration.add(res.timings.duration);
    const ok = check(res, {
      'puzzle_list: status 200': (r) => r.status === 200,
      'puzzle_list: has puzzles array': (r) => {
        const body = r.json();
        return !!(body && Array.isArray(body.puzzles));
      },
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // --- Puzzle list with text search (triggers trigram index) ---
  {
    const url =
      `${BASE_URL}/api/puzzle_list?page=0&pageSize=10` +
      `&filter[nameOrTitleFilter]=nyt` +
      `&filter[sizeFilter][Standard]=true`;
    const res = http.get(url, {tags: {name: 'GET /api/puzzle_list (search)'}});
    puzzleListDuration.add(res.timings.duration);
    check(res, {'puzzle_list search: status 200': (r) => r.status === 200});
  }

  sleep(0.5);

  // --- Game progress (batch event replay) ---
  {
    // Use placeholder gids — the endpoint returns {} for unknown gids, which
    // still exercises the query path. Replace with real gids for staging tests.
    // Default gids from seed.sql (lt-game-1 through lt-game-2000)
    const gids = __ENV.TEST_GIDS
      ? __ENV.TEST_GIDS.split(',')
      : ['lt-game-1', 'lt-game-50', 'lt-game-100', 'lt-game-500', 'lt-game-1000'];
    const res = http.post(
      `${BASE_URL}/api/game-progress`,
      JSON.stringify({gids}),
      {headers: {'Content-Type': 'application/json'}, tags: {name: 'POST /api/game-progress'}}
    );
    gameProgressDuration.add(res.timings.duration);
    const ok = check(res, {
      'game-progress: status 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // --- Puzzle info (lightweight, but high frequency) ---
  {
    // Default pid from seed.sql
    const pid = __ENV.TEST_PID || 'lt-std-1';
    const res = http.get(`${BASE_URL}/api/puzzle/${pid}/info`, {
      tags: {name: 'GET /api/puzzle/:pid/info'},
    });
    puzzleInfoDuration.add(res.timings.duration);
    // 404 is expected for placeholder pids — we're testing latency, not data
    check(res, {
      'puzzle-info: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  }

  sleep(0.3);
}
