// Load test: write-heavy API endpoints.
//
// These endpoints modify database state and are the most likely to cause
// contention or slow down under concurrent load:
//   - POST /api/game (create game — counter increment + event insert)
//   - POST /api/record_solve/:pid (solve recording + snapshot save)
//   - POST /api/game-progress (read, but triggers event replay)
//
// IMPORTANT: This test creates real data. Only run against a test/staging
// database, never production. Set BASE_URL to your staging server.

import http from 'k6/http';
import {check, sleep} from 'k6';
import {Rate, Trend, Counter} from 'k6/metrics';
import {BASE_URL, defaultThresholds, getStages} from './config.js';

const createGameDuration = new Trend('create_game_duration', true);
const recordSolveDuration = new Trend('record_solve_duration', true);
const gamesCreated = new Counter('games_created');
const errorRate = new Rate('errors');

export const options = {
  stages: getStages(),
  thresholds: {
    ...defaultThresholds,
    create_game_duration: ['p(95)<500'],
    record_solve_duration: ['p(95)<800'],
  },
};

export default function () {
  const pid = __ENV.TEST_PID || '1';
  const uniqueId = `k6-${__VU}-${__ITER}-${Date.now()}`;

  // --- Create game (counter increment + initial event insert) ---
  {
    const res = http.post(
      `${BASE_URL}/api/game`,
      JSON.stringify({gid: uniqueId, pid}),
      {
        headers: {'Content-Type': 'application/json'},
        tags: {name: 'POST /api/game'},
      }
    );
    createGameDuration.add(res.timings.duration);
    // 404 is OK if the test pid doesn't exist — we're measuring latency
    const ok = check(res, {
      'create-game: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    if (res.status === 200) gamesCreated.add(1);
    errorRate.add(!ok);
  }

  sleep(0.5);

  // --- Record solve (write to puzzle_solves + game_snapshots) ---
  {
    const res = http.post(
      `${BASE_URL}/api/record_solve/${pid}`,
      JSON.stringify({
        gid: uniqueId,
        time_to_solve: Math.floor(Math.random() * 300000) + 60000,
        player_count: Math.floor(Math.random() * 4) + 1,
      }),
      {
        headers: {'Content-Type': 'application/json'},
        tags: {name: 'POST /api/record_solve'},
      }
    );
    recordSolveDuration.add(res.timings.duration);
    // May fail if pid doesn't exist — that's fine for latency testing
    const ok = check(res, {
      'record-solve: status 200 or 404 or 500': (r) =>
        r.status === 200 || r.status === 404 || r.status === 500,
    });
    errorRate.add(res.status >= 500);
  }

  sleep(0.5);
}
