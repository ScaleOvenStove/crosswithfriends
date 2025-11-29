import {describe, it, expect, vi, beforeEach} from 'vitest';

import apiClient from '../../api/client';
import {createGame} from '../../api/create_game';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('createGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.post with correct parameters', async () => {
    const mockResponse = {gid: 'test-game-id'};
    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    const requestData = {pid: '123', title: 'Test Game'};
    const result = await createGame(requestData);

    expect(apiClient.post).toHaveBeenCalledWith('/api/game', requestData);
    expect(result).toEqual(mockResponse);
  });
});
