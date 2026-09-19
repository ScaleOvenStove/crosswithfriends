import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// Playwright loads .spec.ts files via its built-in TS loader, which emits
// CommonJS. import.meta.url is unreliable in that mode, so resolve fixtures
// off the project root (playwright is always invoked from there).
const fixtureDir = join(process.cwd(), 'e2e', 'fixtures');

// Each test POSTs to /api/puzzle and expects a 400 rejection from the
// server-side validator (see server/model/puzzle.ts:findBrokenPlaceholderField).
//
// IMPORTANT: these must never run against production. By default `pnpm start`
// proxies /api/* to the *production* backend, and if the validator isn't
// deployed there yet the POST creates a real (private, anonymous) puzzle row.
// So the suite only runs when pointed at a backend we know is safe to write
// to, named explicitly via API_BASE_URL (falling back to BASE_URL).
const VALIDATED_BACKENDS = new Set([
  'https://testing.crosswithfriends.com',
  // The local stack CI stands up (postgres + `pnpm devbackend`-style server).
  'http://localhost:3021',
  'http://127.0.0.1:3021',
]);
const apiBaseURL = process.env.API_BASE_URL || process.env.BASE_URL || '';
const validatorDeployed = VALIDATED_BACKENDS.has(apiBaseURL);

// The PuzzleJson shape that POST /api/puzzle expects, with no [?] markers
// anywhere — mirrors what iPUZtoJSON would output for the clean fixture.
function buildCleanPuzzleJson() {
  return {
    info: {
      type: 'Mini Puzzle',
      title: 'Suit Test (clean)',
      author: 'tester',
      description: '',
    },
    grid: [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ],
    clues: {
      across: [null, 'Top row', null, null, 'Middle row', 'Bottom row'],
      down: [null, 'Left col', 'Middle col', 'Right col'],
    },
    circles: [],
    shades: [],
  };
}

test.describe('POST /api/puzzle — broken-placeholder rejection', () => {
  test.skip(
    !validatorDeployed,
    `Skipped: set API_BASE_URL to a backend that is safe to write to and has the ` +
      `rejection deployed (http://localhost:3021 for the local stack, or ` +
      `https://testing.crosswithfriends.com). Without it these would hit prod through the ` +
      `local Vite proxy and could create real rows.`
  );

  test('rejects a puzzle whose clue contains "[?]"', async ({request}) => {
    const puzzle = buildCleanPuzzleJson();
    puzzle.clues.down[1] = 'A[?] 9[?] 6[?] 4[?] 2[?], e.g.';

    const resp = await request.post(`${apiBaseURL}/api/puzzle`, {
      data: {puzzle, isPublic: false},
      failOnStatusCode: false,
    });

    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/clues\.down\[1\] contains "\[\?\]"/);
  });

  test('rejects a puzzle whose title contains "[?]"', async ({request}) => {
    const puzzle = buildCleanPuzzleJson();
    puzzle.info.title = 'Moral High Ground [?]';

    const resp = await request.post(`${apiBaseURL}/api/puzzle`, {
      data: {puzzle, isPublic: false},
      failOnStatusCode: false,
    });

    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/info\.title contains "\[\?\]"/);
  });

  test('the .ipuz fixture also rejects when converted to PuzzleJson shape', async ({request}) => {
    // The fixture file is what a user might drag-and-drop into the upload UI.
    // We replicate what iPUZtoJSON would produce for it (just the parts the
    // validator scans) and confirm the same rejection path fires.
    const ipuz = JSON.parse(readFileSync(join(fixtureDir, 'suit-test-broken.ipuz'), 'utf8'));
    const downClueWithMarker = ipuz.clues.Down[0][1];
    expect(downClueWithMarker).toContain('[?]'); // sanity: fixture is what we think

    const puzzle = buildCleanPuzzleJson();
    puzzle.info.title = ipuz.title;
    puzzle.clues.down[1] = downClueWithMarker;

    const resp = await request.post(`${apiBaseURL}/api/puzzle`, {
      data: {puzzle, isPublic: false},
      failOnStatusCode: false,
    });

    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('[?]');
  });
});
