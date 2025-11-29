import {describe, it, expect, vi, beforeEach} from 'vitest';

import apiClient from '../../api/client';
import {fetchStats} from '../../api/stats';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('fetchStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.post with query parameters', async () => {
    const mockResponse = {stats: []};
    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    const query = {page: 1, pageSize: 10};
    const result = await fetchStats(query);

    expect(apiClient.post).toHaveBeenCalledWith('/api/stats', query);
    expect(result).toEqual(mockResponse);
  });
});
