// Load test: authentication endpoints.
//
// Tests the auth flow under concurrent load:
//   - POST /api/auth/login  (once per VU in setup — bcrypt is intentionally slow)
//   - GET  /api/auth/me     (hammered in iterations — JWT verify + DB lookup)
//
// Login is tested once per user in setup() to avoid hitting the rate limiter
// (10 req/15min per IP). Each VU gets its own user from the seed pool to
// spread the load across different accounts.

import http from 'k6/http';
import {check, sleep} from 'k6';
import {Rate, Trend} from 'k6/metrics';
import {BASE_URL, strictThresholds, getStages} from './config.js';

const loginDuration = new Trend('login_duration', true);
const meDuration = new Trend('me_duration', true);
const errorRate = new Rate('errors');

export const options = {
  stages: getStages(),
  thresholds: {
    ...strictThresholds,
    // Override global http_req_duration — login calls (bcrypt + TLS) are
    // intentionally slow and skew the aggregate. The per-endpoint custom
    // metrics below are what actually matter.
    http_req_duration: ['p(95)<500'],
    login_duration: ['p(95)<1500'],
    me_duration: ['p(95)<200'],
  },
};

export function setup() {
  const password = __ENV.TEST_USER_PASSWORD || 'password123';

  // Login multiple users upfront so each VU gets a token without re-logging in.
  // This avoids hammering the rate-limited login endpoint during the test.
  const tokens = [];
  const maxUsers = 10; // enough for stress profile (up to 150 VUs share these)

  for (let i = 1; i <= maxUsers; i++) {
    const email = __ENV.TEST_USER_EMAIL || `loadtest_user_${i}@test.example.com`;
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({email, password}),
      {headers: {'Content-Type': 'application/json'}}
    );
    loginDuration.add(res.timings.duration);
    if (res.status === 200) {
      const body = JSON.parse(res.body);
      tokens.push(body.accessToken);
    } else {
      console.warn(`Setup login failed for user ${i} with status ${res.status}`);
    }
    // If a custom email was provided, only login once
    if (__ENV.TEST_USER_EMAIL) break;
  }

  if (tokens.length === 0) {
    console.error('No logins succeeded — auth tests will only check error paths');
  } else {
    console.log(`Setup: ${tokens.length} users logged in successfully`);
  }

  return {tokens};
}

export default function (data) {
  // Each VU picks a token from the pool (round-robin by VU ID)
  const token = data.tokens.length > 0 ? data.tokens[__VU % data.tokens.length] : null;

  // --- GET /api/auth/me (JWT verification + DB lookup) ---
  {
    const headers = token ? {Authorization: `Bearer ${token}`} : {};
    const res = http.get(`${BASE_URL}/api/auth/me`, {
      headers,
      tags: {name: 'GET /api/auth/me'},
    });
    meDuration.add(res.timings.duration);
    if (token) {
      const ok = check(res, {'me: status 200': (r) => r.status === 200});
      errorRate.add(!ok);
    } else {
      check(res, {'me (no token): status 401': (r) => r.status === 401});
    }
  }

  sleep(0.5);
}
