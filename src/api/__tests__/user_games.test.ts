import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {fetchGuestPuzzleStatuses, UserGamesUnavailableError} from '../user_games';

describe('fetchGuestPuzzleStatuses', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (body: unknown, ok = true, status = 200) =>
    vi.mocked(fetch).mockResolvedValue({ok, status, json: async () => body} as Response);

  it('returns the statuses on success', async () => {
    respond({statuses: {'123': 'solved', '456': 'started'}});

    await expect(fetchGuestPuzzleStatuses('dfac-abc')).resolves.toEqual({
      '123': 'solved',
      '456': 'started',
    });
  });

  it('returns an empty map when the guest genuinely has no games', async () => {
    respond({statuses: {}});

    await expect(fetchGuestPuzzleStatuses('dfac-abc')).resolves.toEqual({});
  });

  // These three must reject, not resolve to {}. NewPuzzleList writes whatever
  // resolves straight into localStorage, so an empty map from a failed lookup
  // would wipe the guest's Complete/In progress badges. A rejection leaves the
  // cached statuses untouched.
  it('rejects when the server flags the response degraded', async () => {
    respond({statuses: {}, degraded: true});

    await expect(fetchGuestPuzzleStatuses('dfac-abc')).rejects.toBeInstanceOf(UserGamesUnavailableError);
  });

  it('rejects on a non-ok response', async () => {
    respond({}, false, 503);

    await expect(fetchGuestPuzzleStatuses('dfac-abc')).rejects.toBeInstanceOf(UserGamesUnavailableError);
  });

  it('rejects when the request itself fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network error'));

    await expect(fetchGuestPuzzleStatuses('dfac-abc')).rejects.toThrow();
  });
});
