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
  dfacId?: string
): Promise<UserGame[]> {
  try {
    const params = new URLSearchParams({pid: String(pid)});
    if (dfacId) params.set('dfac_id', dfacId);

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const resp = await fetch(`${SERVER_URL}/api/user-games?${params}`, {headers});
    if (!resp.ok) return [];

    const data = await resp.json();
    return data.games;
  } catch {
    return [];
  }
}

export async function fetchGuestPuzzleStatuses(
  dfacId: string
): Promise<{[pid: string]: 'solved' | 'started'}> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/user-games/statuses?dfac_id=${encodeURIComponent(dfacId)}`);
    if (!resp.ok) return {};

    const data = await resp.json();
    return data.statuses;
  } catch {
    return {};
  }
}
