import * as Sentry from '@sentry/react';
import {CreateGameRequest, CreateGameResponse} from '../shared/types';
import {SERVER_URL} from './constants';

export async function createGame(
  data: CreateGameRequest,
  accessToken?: string | null
): Promise<CreateGameResponse> {
  const url = `${SERVER_URL}/api/game`;
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    let message = `Game creation failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body.error) message = body.error;
    } catch {
      // response wasn't JSON, use default message
    }
    const err = new Error(message);
    Sentry.captureException(err, {extra: {gid: data.gid, pid: data.pid, status: resp.status}});
    throw err;
  }
  return resp.json();
}

export async function dismissGame(gid: string, accessToken: string): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/dismiss`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  return resp.ok;
}

export async function undismissGame(gid: string, accessToken: string): Promise<void> {
  await fetch(`${SERVER_URL}/api/game/${gid}/undismiss`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
}

export async function kickPlayer(
  gid: string,
  target: {dfac_id?: string; user_id?: string},
  accessToken: string
): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/kick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(target),
  });
  return resp.ok;
}

export async function unkickPlayer(
  gid: string,
  target: {dfac_id?: string; user_id?: string},
  accessToken: string
): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/unkick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(target),
  });
  return resp.ok;
}

export async function lockGame(gid: string, accessToken: string): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/lock`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  return resp.ok;
}

export async function unlockGame(gid: string, accessToken: string): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/unlock`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  return resp.ok;
}

export type RestrictableAction = 'check' | 'reveal' | 'reset';
export const RESTRICTABLE_ACTIONS: readonly RestrictableAction[] = ['check', 'reveal', 'reset'];

export type GameRestrictions = Record<RestrictableAction, boolean>;

export const EMPTY_RESTRICTIONS: GameRestrictions = {check: false, reveal: false, reset: false};

export interface GameModerationState {
  locked: boolean;
  owner: {userId?: string; dfacId?: string} | null;
  kickedDfacIds: string[];
  restrictions: GameRestrictions;
  // Server-resolved against the caller's bearer token (false for guests).
  // The client can't compute this itself for the cross-device case where
  // a user created the game as a guest on another device and the dfac id
  // in the create event is one of their linked-but-not-local ids.
  isOwner: boolean;
}

export async function setGameRestriction(
  gid: string,
  action: RestrictableAction,
  accessToken: string
): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/restrictions/${action}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  return resp.ok;
}

export async function clearGameRestriction(
  gid: string,
  action: RestrictableAction,
  accessToken: string
): Promise<boolean> {
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/restrictions/${action}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  return resp.ok;
}

export async function fetchGameModeration(
  gid: string,
  accessToken?: string | null
): Promise<GameModerationState | null> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const resp = await fetch(`${SERVER_URL}/api/game/${gid}/moderation`, {headers});
  if (!resp.ok) return null;
  const body = await resp.json();
  // Normalize: a server without the restrictions feature deployed yet
  // omits the field. Default to no restrictions so the UI can treat the
  // shape as required.
  return {...body, restrictions: {...EMPTY_RESTRICTIONS, ...(body.restrictions || {})}};
}
