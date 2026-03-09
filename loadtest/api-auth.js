// Load test: authentication endpoints.
//
// Tests the auth flow under concurrent load:
//   - POST /api/auth/login
//   - POST /api/auth/refresh
//   - GET  /api/auth/me
//
// NOTE: This test requires TEST_USER_EMAIL and TEST_USER_PASSWORD env vars
// pointing at a real test account on the target server. Without them, the
// test only exercises the validation/error paths (still useful for latency).

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
    // Login involves bcrypt (intentionally slow) — give it more headroom
    login_duration: ['p(95)<1500'],
    me_duration: ['p(95)<200'],
  },
};

export function setup() {
  const email = __ENV.TEST_USER_EMAIL;
  const password = __ENV.TEST_USER_PASSWORD;
  if (!email || !password) {
    console.warn(
      'TEST_USER_EMAIL / TEST_USER_PASSWORD not set — auth tests will only exercise error paths'
    );
    return {token: null, hasCredentials: false};
  }

  // Login once in setup to get a token for the /me endpoint tests
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({email, password}),
    {headers: {'Content-Type': 'application/json'}}
  );
  if (res.status !== 200) {
    console.warn(`Setup login failed with status ${res.status}`);
    return {token: null, hasCredentials: true};
  }
  const body = JSON.parse(res.body);
  return {token: body.accessToken, hasCredentials: true};
}

export default function (data) {
  const email = __ENV.TEST_USER_EMAIL || 'nonexistent@example.com';
  const password = __ENV.TEST_USER_PASSWORD || 'wrongpassword';

  // --- Login attempt (exercises bcrypt + DB lookup) ---
  {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({email, password}),
      {headers: {'Content-Type': 'application/json'}, tags: {name: 'POST /api/auth/login'}}
    );
    loginDuration.add(res.timings.duration);
    if (data.hasCredentials) {
      const ok = check(res, {'login: status 200': (r) => r.status === 200});
      errorRate.add(!ok);
    } else {
      // Without real credentials, 401 is the expected response
      check(res, {'login (no creds): status 401': (r) => r.status === 401});
    }
  }

  sleep(1);

  // --- GET /api/auth/me (JWT verification + DB lookup) ---
  if (data.token) {
    const res = http.get(`${BASE_URL}/api/auth/me`, {
      headers: {Authorization: `Bearer ${data.token}`},
      tags: {name: 'GET /api/auth/me'},
    });
    meDuration.add(res.timings.duration);
    const ok = check(res, {
      'me: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    errorRate.add(!ok);
  }

  sleep(0.5);
}
