import type {CreateGameRequest, CreateGameResponse} from '@crosswithfriends/shared/types';

import apiClient from './client';

export async function createGame(data: CreateGameRequest): Promise<CreateGameResponse> {
  return apiClient.post<CreateGameResponse>('/api/game', data);
}
