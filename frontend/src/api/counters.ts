import apiClient from './client';
import type {IncrementGidResponse, IncrementPidResponse} from '@crosswithfriends/shared/types';

// ========== POST /api/counters/gid ============
export async function incrementGid(): Promise<IncrementGidResponse> {
  return apiClient.post<IncrementGidResponse>('/api/counters/gid', {});
}

// ========== POST /api/counters/pid ============
export async function incrementPid(): Promise<IncrementPidResponse> {
  return apiClient.post<IncrementPidResponse>('/api/counters/pid', {});
}
