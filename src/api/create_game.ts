import * as Sentry from '@sentry/react';
import {CreateGameRequest, CreateGameResponse} from '../shared/types';
import {SERVER_URL} from './constants';

export async function createGame(data: CreateGameRequest): Promise<CreateGameResponse> {
  const url = `${SERVER_URL}/api/game`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
