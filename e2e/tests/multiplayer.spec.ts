import {test, expect, Browser, BrowserContext, Page} from '@playwright/test';

/**
 * Two-player tests for the real-time path: client -> Socket.IO -> SocketManager
 * -> game_events -> broadcast -> other client.
 *
 * This is the product's core feature and the one layer no other suite reaches.
 * The store-level tests in src/store/__tests__/game.test.js cover the offline
 * queue well, but they mock the socket, so nothing else exercises the round
 * trip through the server and the database.
 *
 * These tests WRITE (they create a game and persist events), so they only run
 * against a backend that is safe to write to. `pnpm start` proxies to the
 * production backend, so the default localhost setup is skipped unless
 * VITE_USE_LOCAL_SERVER is set — which is what CI does after standing up a
 * local postgres and server.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3020';
const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
const targetsProductionBackend = isLocal && !process.env.VITE_USE_LOCAL_SERVER;

/** Puzzle seeded by e2e/fixtures/seed-e2e.sql. */
const E2E_PID = process.env.E2E_PID || 'e2e-mini-1';

test.describe('Multiplayer sync', () => {
  test.skip(
    targetsProductionBackend,
    'Skipped: these create games and persist events. Run with VITE_USE_LOCAL_SERVER=1 against a ' +
      'local backend, or set BASE_URL to the testing environment.'
  );

  // Two browsers plus a page load is a lot of round trips for one test.
  test.setTimeout(90_000);

  let contexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await Promise.all(contexts.map((c) => c.close()));
    contexts = [];
  });

  /** A fresh context gets its own localStorage, so its own dfac_id — a distinct player. */
  async function newPlayer(browser: Browser): Promise<Page> {
    const context = await browser.newContext();
    contexts.push(context);
    return context.newPage();
  }

  async function waitForGrid(page: Page): Promise<void> {
    await expect(page.locator('table.grid')).toBeVisible({timeout: 20_000});
    await expect(page.locator('td.grid--cell').first()).toBeVisible({timeout: 15_000});
  }

  /** Create a game on the fixture puzzle, and return its /beta/game/:gid URL. */
  async function createGame(page: Page): Promise<string> {
    await page.goto(`/beta/play/${E2E_PID}`);
    await page.waitForURL(/\/beta\/game\/[^/]+$/, {timeout: 20_000});
    await waitForGrid(page);
    return page.url();
  }

  /** The {r, c} of the nth white cell, so two players can write to different cells. */
  async function nthWhiteCell(page: Page, n: number): Promise<{r: number; c: number}> {
    const rc = await page.evaluate((index) => {
      const white = Array.from(document.querySelectorAll('td.grid--cell')).filter((cell) => {
        const div = cell.querySelector('.cell');
        return div && !div.classList.contains('black');
      });
      return white[index]?.getAttribute('data-rc') ?? null;
    }, n);
    if (!rc) throw new Error(`Grid has fewer than ${n + 1} white cells`);
    const [r, c] = rc.split(' ').map(Number);
    return {r, c};
  }

  function cell(page: Page, r: number, c: number) {
    return page.locator(`td.grid--cell[data-rc="${r} ${c}"]`);
  }

  async function typeInto(page: Page, r: number, c: number, letter: string): Promise<void> {
    await cell(page, r, c).click();
    await page.keyboard.press(letter);
  }

  function valueOf(page: Page, r: number, c: number) {
    return cell(page, r, c).locator('.cell--value');
  }

  test('a letter typed by one player appears in the other player’s grid', async ({browser}) => {
    const alice = await newPlayer(browser);
    const gameUrl = await createGame(alice);

    const bob = await newPlayer(browser);
    await bob.goto(gameUrl);
    await waitForGrid(bob);

    const target = await nthWhiteCell(alice, 0);
    await typeInto(alice, target.r, target.c, 'A');

    await expect(valueOf(alice, target.r, target.c)).toHaveText('A');
    // The assertion that matters: it crossed the wire.
    await expect(valueOf(bob, target.r, target.c)).toHaveText('A', {timeout: 15_000});
  });

  test('both players can write and each sees the other’s letters', async ({browser}) => {
    const alice = await newPlayer(browser);
    const gameUrl = await createGame(alice);

    const bob = await newPlayer(browser);
    await bob.goto(gameUrl);
    await waitForGrid(bob);

    const aliceCell = await nthWhiteCell(alice, 0);
    const bobCell = await nthWhiteCell(alice, 1);

    await typeInto(alice, aliceCell.r, aliceCell.c, 'X');
    await expect(valueOf(bob, aliceCell.r, aliceCell.c)).toHaveText('X', {timeout: 15_000});

    await typeInto(bob, bobCell.r, bobCell.c, 'Y');
    await expect(valueOf(alice, bobCell.r, bobCell.c)).toHaveText('Y', {timeout: 15_000});

    // Neither write clobbered the other.
    await expect(valueOf(alice, aliceCell.r, aliceCell.c)).toHaveText('X');
    await expect(valueOf(bob, bobCell.r, bobCell.c)).toHaveText('Y');
  });

  test('a player joining later replays the history from the server', async ({browser}) => {
    // Covers sync_all_game_events: the letters were broadcast before this
    // player existed, so the only way they can show up is persistence + replay.
    const alice = await newPlayer(browser);
    const gameUrl = await createGame(alice);

    const first = await nthWhiteCell(alice, 0);
    const second = await nthWhiteCell(alice, 1);
    await typeInto(alice, first.r, first.c, 'H');
    await typeInto(alice, second.r, second.c, 'I');
    await expect(valueOf(alice, second.r, second.c)).toHaveText('I');

    const latecomer = await newPlayer(browser);
    await latecomer.goto(gameUrl);
    await waitForGrid(latecomer);

    await expect(valueOf(latecomer, first.r, first.c)).toHaveText('H', {timeout: 15_000});
    await expect(valueOf(latecomer, second.r, second.c)).toHaveText('I', {timeout: 15_000});
  });

  test('a reload restores the grid the player left behind', async ({browser}) => {
    const alice = await newPlayer(browser);
    const gameUrl = await createGame(alice);

    const target = await nthWhiteCell(alice, 0);
    await typeInto(alice, target.r, target.c, 'R');
    await expect(valueOf(alice, target.r, target.c)).toHaveText('R');

    await alice.reload();
    await waitForGrid(alice);

    await expect(valueOf(alice, target.r, target.c)).toHaveText('R', {timeout: 15_000});
  });

  test('letters typed while disconnected reach the other player after reconnecting', async ({browser}) => {
    // The offline queue in src/store/game.js mirrors unsent events to
    // localStorage and flushes them when the socket reconnects. The unit tests
    // cover the queue against a mocked socket; this covers the real handshake.
    //
    // The disconnect is driven through the client socket rather than
    // context.setOffline(), which leaves an already-open WebSocket alive — the
    // event then goes straight out and the queue is never exercised at all.
    const alice = await newPlayer(browser);
    const gameUrl = await createGame(alice);

    const bob = await newPlayer(browser);
    await bob.goto(gameUrl);
    await waitForGrid(bob);

    const target = await nthWhiteCell(alice, 0);

    await alice.evaluate(() => (window as any).socket.disconnect());
    await expect
      .poll(() => alice.evaluate(() => (window as any).socket.connected), {timeout: 10_000})
      .toBe(false);

    await typeInto(alice, target.r, target.c, 'Q');
    // Applied optimistically on Alice's own grid with no connection...
    await expect(valueOf(alice, target.r, target.c)).toHaveText('Q');
    // ...and parked in localStorage rather than lost.
    await expect
      .poll(
        () =>
          alice.evaluate(
            () => Object.keys(window.localStorage).filter((k) => k.startsWith('offline_queue')).length
          ),
        {timeout: 10_000}
      )
      .toBeGreaterThan(0);
    // Nothing reached Bob while the socket was down.
    await expect(valueOf(bob, target.r, target.c)).not.toHaveText('Q');

    await alice.evaluate(() => (window as any).socket.connect());

    await expect(valueOf(bob, target.r, target.c)).toHaveText('Q', {timeout: 30_000});
    // The queue drained rather than replaying forever.
    await expect
      .poll(
        () =>
          alice.evaluate(() =>
            Object.keys(window.localStorage)
              .filter((k) => k.startsWith('offline_queue'))
              .reduce((n, k) => n + JSON.parse(window.localStorage.getItem(k) || '[]').length, 0)
          ),
        {timeout: 15_000}
      )
      .toBe(0);
  });
});
