import {IncrementGidResponse, IncrementPidResponse} from '@crosswithfriends/shared/types';
import {SERVER_URL} from './constants';

// ========== POST /api/counters/gid ============
export async function incrementGid(): Promise<IncrementGidResponse> {
  const url = `${SERVER_URL}/api/counters/gid`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}), // Send empty body to satisfy Fastify's body parser
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    let errorMessage = `Failed to increment GID: ${resp.status} ${resp.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }
    throw new Error(errorMessage);
  }

  return resp.json();
}

// ========== POST /api/counters/pid ============
export async function incrementPid(): Promise<IncrementPidResponse> {
  const url = `${SERVER_URL}/api/counters/pid`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}), // Send empty body to satisfy Fastify's body parser
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    let errorMessage = `Failed to increment PID: ${resp.status} ${resp.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }
    throw new Error(errorMessage);
  }

  return resp.json();
}
