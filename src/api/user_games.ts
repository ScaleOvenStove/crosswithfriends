import {SERVER_URL} from './constants';

export type UserGame = {
  gid: string;
  pid: string;
  solved: boolean;
  time: number;
  v2: boolean;
  percentComplete: number;
};

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
  if (!resp.ok) return [];

  const data = await resp.json();
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
