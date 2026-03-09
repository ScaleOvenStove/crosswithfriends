# Load Tests (k6)

Load tests for the Cross with Friends API and WebSocket server.

## Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```sh
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6
```

## Seed Data

Load tests need realistic data to catch production-scale issues. A seed script creates
~200 users, ~500 puzzles, ~2000 games with ~20K events, ~1500 solves, and ~1000 snapshots:

```sh
# After initializing an empty database:
psql -f server/sql/create_fresh_db.sql
psql -f loadtest/seed.sql
```

CI does this automatically. For local testing, seed your dev database once.

## Quick Start

```sh
# Start the backend first (seed the DB if you haven't already)
pnpm devbackend

# Run smoke tests (fast, 5 VUs, ~35 seconds)
pnpm loadtest

# Run all test suites
pnpm loadtest:all

# Full load profile (20-50 VUs, ~2.5 minutes)
pnpm loadtest:full

# Stress test (up to 150 VUs, ~3.5 minutes)
pnpm loadtest:stress
```

## Test Suites

| Script | What it tests | Key metrics |
|--------|--------------|-------------|
| `api-read.js` | Puzzle list, game progress, puzzle info | `puzzle_list_duration`, `game_progress_duration` |
| `api-auth.js` | Login, token refresh, /me | `login_duration`, `me_duration` |
| `api-write.js` | Game creation, solve recording | `create_game_duration`, `record_solve_duration` |
| `websocket.js` | Socket.IO connections, game events | `ws_connection_duration`, `ws_connection_errors` |

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `BASE_URL` | `http://localhost:3021` | Target server |
| `K6_PROFILE` | `smoke` | Test profile: `smoke`, `load`, or `stress` |
| `TEST_USER_EMAIL` | `loadtest_user_1@test.example.com` | Email for authenticated tests |
| `TEST_USER_PASSWORD` | `password123` | Password for authenticated tests |
| `TEST_PID` | `lt-std-1` | Puzzle ID to use in tests |
| `TEST_GIDS` | `lt-game-1,...` | Comma-separated game IDs for progress tests |

## Profiles

- **smoke** (default): 5 VUs, 35s — sanity check, runs in CI on every PR
- **load**: 20-50 VUs, 2.5min — simulates normal production traffic
- **stress**: 50-150 VUs, 3.5min — finds breaking points

## Thresholds

Tests fail if thresholds are breached:

- `http_req_duration p(95) < 500ms` — 95th percentile response time
- `http_req_failed rate < 0.01` — less than 1% error rate
- Per-endpoint thresholds vary (see individual scripts)

## CI Integration

Load tests run automatically on PRs that change `server/` or `loadtest/` files.
Manual runs with configurable profile available via GitHub Actions workflow dispatch.

## Running Against Staging

```sh
BASE_URL=https://testing.crosswithfriends.com K6_PROFILE=load pnpm loadtest:all
```
