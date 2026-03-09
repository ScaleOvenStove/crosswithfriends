// Shared k6 configuration and helpers for load tests.
//
// Environment variables:
//   BASE_URL  – target server (default: http://localhost:3021)
//   TEST_USER_EMAIL    – email for authenticated tests
//   TEST_USER_PASSWORD – password for authenticated tests

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3021';

// Default thresholds – the load test fails CI if any of these are breached.
export const defaultThresholds = {
  // 95th-percentile response time must stay under 500ms
  http_req_duration: ['p(95)<500'],
  // Less than 1% of requests may fail
  http_req_failed: ['rate<0.01'],
};

// Stricter thresholds for lightweight endpoints (puzzle info, auth/me, etc.)
export const strictThresholds = {
  http_req_duration: ['p(95)<250'],
  http_req_failed: ['rate<0.01'],
};

// Standard stage profiles.
export const smokeStages = [
  {duration: '10s', target: 5},
  {duration: '20s', target: 5},
  {duration: '5s', target: 0},
];

export const loadStages = [
  {duration: '30s', target: 20}, // ramp up
  {duration: '1m', target: 20}, // hold
  {duration: '15s', target: 50}, // spike
  {duration: '30s', target: 50}, // hold spike
  {duration: '15s', target: 0}, // ramp down
];

export const stressStages = [
  {duration: '30s', target: 50},
  {duration: '1m', target: 100},
  {duration: '30s', target: 150},
  {duration: '1m', target: 150},
  {duration: '30s', target: 0},
];

// Pick stage profile from K6_PROFILE env var (default: smoke for CI speed).
export function getStages() {
  const profile = (__ENV.K6_PROFILE || 'smoke').toLowerCase();
  if (profile === 'stress') return stressStages;
  if (profile === 'load') return loadStages;
  return smokeStages;
}

// Login helper – returns an access token string.
export function login(http, email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({email, password}),
    {headers: {'Content-Type': 'application/json'}}
  );
  if (res.status === 200) {
    return JSON.parse(res.body).accessToken;
  }
  return null;
}

// Convenience: build Authorization header from a token.
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
