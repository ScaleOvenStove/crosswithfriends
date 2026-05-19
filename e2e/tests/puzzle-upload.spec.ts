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
// IMPORTANT: only run when targeting an environment that has the validator
// deployed. By default, `pnpm test:e2e` runs against http://localhost:3020
// where Vite proxies /api/* to the *production* backend — if the validator
// isn't deployed yet, the POST creates a real (private, anonymous) puzzle
// row in prod. Gating to the testing env avoids that and matches how the
// post-deploy workflow (`.github/workflows/deploy-tests.yml`) invokes us.
const VALIDATED_BACKENDS = new Set([
  'https://testing.crosswithfriends.com',
  // Add 'http://localhost:3021' if you've wired up a local backend and want
  // to run these tests against it directly.
]);
const baseURL = process.env.BASE_URL || '';
const validatorDeployed = VALIDATED_BACKENDS.has(baseURL);

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
    `Skipped: set BASE_URL to a backend with the rejection deployed ` +
      `(e.g. https://testing.crosswithfriends.com) to run these. By default they would hit prod via ` +
      `the local Vite proxy and could create real rows.`
  );

  test('rejects a puzzle whose clue contains "[?]"', async ({request}) => {
    const puzzle = buildCleanPuzzleJson();
    puzzle.clues.down[1] = 'A[?] 9[?] 6[?] 4[?] 2[?], e.g.';

    const resp = await request.post('/api/puzzle', {
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

    const resp = await request.post('/api/puzzle', {
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

    const resp = await request.post('/api/puzzle', {
      data: {puzzle, isPublic: false},
      failOnStatusCode: false,
    });

    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('[?]');
  });
});
