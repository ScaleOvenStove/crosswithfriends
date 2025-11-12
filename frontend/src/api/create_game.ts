import apiClient from './client';
import type {CreateGameRequest, CreateGameResponse} from '@crosswithfriends/shared/types';

export async function createGame(data: CreateGameRequest): Promise<CreateGameResponse> {
  return apiClient.post<CreateGameResponse>('/api/game', data);
}
