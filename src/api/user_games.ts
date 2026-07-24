import {SERVER_URL} from './constants';

export type UserGame = {
  gid: string;
  pid: string;
  solved: boolean;
  time: number;
  v2: boolean;
  percentComplete: number;
};

/**
 * Thrown when the user-games lookup could not be completed — an HTTP error, or
 * a response the server flagged `degraded` after a statement_timeout. Callers
 * must NOT treat this as "the user has no games": Play.js autocreates a fresh
 * blank game whenever the loaded list is empty, so surfacing a failed lookup as
 * an empty list hides the user's real in-progress game (the "blank in-progress
 * games" report). Surface it as a retryable failure instead.
 */
export class UserGamesUnavailableError extends Error {
  constructor(message = 'user-games lookup unavailable') {
    super(message);
    this.name = 'UserGamesUnavailableError';
  }
}

export async function fetchUserGames(
  pid: string | number,
  accessToken?: string | null,
  dfacId?: string,
  skipCache?: boolean
): Promise<UserGame[]> {
  const params = new URLSearchParams({pid: String(pid)});
  if (dfacId) params.set('dfac_id', dfacId);
  if (skipCache) params.set('_t', String(Date.now()));

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const fetchOptions: RequestInit = {headers};
  if (skipCache) {
    fetchOptions.cache = 'no-store';
  }

  const resp = await fetch(`${SERVER_URL}/api/user-games?${params}`, fetchOptions);
  // A failed request is not an authoritative "no games" result. Returning an
  // empty list here makes Play.js autocreate a brand-new blank game over the
  // user's existing one, so raise a retryable error the caller can surface.
  if (!resp.ok) {
    throw new UserGamesUnavailableError(`user-games request failed (${resp.status})`);
  }

  const data = await resp.json();
  // The server degrades to {games: [], degraded: true} when the lookup trips
  // statement_timeout. Same reasoning: don't let the caller treat the degraded
  // empty list as real, or the user gets dropped into a fresh blank game.
  if (data.degraded) {
    throw new UserGamesUnavailableError('user-games temporarily unavailable');
  }
  return data.games;
}

export async function fetchGuestPuzzleStatuses(
  dfacId: string
): Promise<{[pid: string]: 'solved' | 'started'}> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/user-games/statuses?dfac_id=${encodeURIComponent(dfacId)}`);
    if (!resp.ok) return {};

    const data = await resp.json();
    return data.statuses;
  } catch (error) {
    console.warn('Failed to fetch guest puzzle statuses:', error);
    return {};
  }
}
