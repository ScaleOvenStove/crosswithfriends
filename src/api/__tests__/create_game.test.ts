import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import * as Sentry from '@sentry/react';
import {createGame} from '../create_game';

vi.mock('@sentry/react', () => ({captureException: vi.fn()}));

describe('createGame', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(Sentry.captureException).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (body: unknown, ok = true, status = 200) =>
    vi.mocked(fetch).mockResolvedValue({ok, status, json: async () => body} as Response);

  const req = {gid: 'g1', pid: 'p1', dfac_id: 'd1'};

  it('returns the response body on success', async () => {
    respond({gid: 'g1'});
    await expect(createGame(req)).resolves.toEqual({gid: 'g1'});
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  // Deleted or merged puzzles are expected; reporting them flooded Sentry
  // (JAVASCRIPT-REACT-5G) without anything to fix.
  it('rejects with the server message on 404 without reporting to Sentry', async () => {
    respond({error: 'Puzzle not found: p1'}, false, 404);
    await expect(createGame(req)).rejects.toMatchObject({
      message: 'Puzzle not found: p1',
      puzzleNotFound: true,
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('marks 429 as rate limited without reporting to Sentry', async () => {
    respond({error: 'Too many requests'}, false, 429);
    await expect(createGame(req)).rejects.toMatchObject({rateLimited: true});
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports other HTTP failures to Sentry', async () => {
    respond({error: 'boom'}, false, 500);
    await expect(createGame(req)).rejects.toThrow('boom');
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
