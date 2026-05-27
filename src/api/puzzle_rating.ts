import {SERVER_URL} from './constants';

export interface PuzzleRatingAggregate {
  average: number | null;
  count: number;
  userRating: number | null;
}

export class RatingNotEligibleError extends Error {
  thresholdPercent: number;
  constructor(thresholdPercent: number) {
    super('not_eligible');
    this.name = 'RatingNotEligibleError';
    this.thresholdPercent = thresholdPercent;
  }
}

// Thrown when the request is rejected for an expired/invalid session (401).
// This is an expected auth-expiry state, not a bug — callers should re-prompt
// sign-in rather than reporting it to Sentry.
export class RatingAuthError extends Error {
  constructor() {
    super('auth_required');
    this.name = 'RatingAuthError';
  }
}

function authHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken ? {Authorization: `Bearer ${accessToken}`} : {};
}

export async function fetchPuzzleRating(
  pid: string,
  accessToken?: string | null
): Promise<PuzzleRatingAggregate> {
  const resp = await fetch(`${SERVER_URL}/api/puzzle_rating/${encodeURIComponent(pid)}`, {
    headers: authHeaders(accessToken),
  });
  if (!resp.ok) throw new Error(`Failed to fetch rating (${resp.status})`);
  return resp.json();
}

export async function submitPuzzleRating(
  pid: string,
  rating: number,
  accessToken: string
): Promise<PuzzleRatingAggregate> {
  const resp = await fetch(`${SERVER_URL}/api/puzzle_rating/${encodeURIComponent(pid)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...authHeaders(accessToken)},
    body: JSON.stringify({rating}),
  });
  if (resp.status === 403) {
    const body = await resp.json().catch(() => ({}));
    throw new RatingNotEligibleError(body.thresholdPercent ?? 25);
  }
  if (resp.status === 401) {
    throw new RatingAuthError();
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `Failed to submit rating (${resp.status})`);
  }
  return resp.json();
}

export async function deletePuzzleRating(pid: string, accessToken: string): Promise<PuzzleRatingAggregate> {
  const resp = await fetch(`${SERVER_URL}/api/puzzle_rating/${encodeURIComponent(pid)}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!resp.ok) throw new Error(`Failed to delete rating (${resp.status})`);
  return resp.json();
}
