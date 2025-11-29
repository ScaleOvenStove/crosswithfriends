import {describe, it, expect, vi, beforeEach} from 'vitest';

import apiClient from '../../api/client';
import {fetchPuzzleList} from '../../api/puzzle_list';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('fetchPuzzleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.get with query parameters', async () => {
    const mockResponse = {puzzles: [], total: 0};
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const query = {
      page: 1,
      pageSize: 10,
      filter: {
        sizeFilter: {Mini: true, Standard: false},
        nameOrTitleFilter: 'test',
      },
    };

    const result = await fetchPuzzleList(query);

    expect(apiClient.get).toHaveBeenCalled();
    const callUrl = vi.mocked(apiClient.get).mock.calls[0][0];
    expect(callUrl).toContain('page=1');
    expect(callUrl).toContain('pageSize=10');
    // URL encoding - brackets are encoded as %5B and %5D
    expect(callUrl).toContain('filter%5BsizeFilter%5D%5BMini%5D=true');
    expect(callUrl).toContain('filter%5BnameOrTitleFilter%5D=test');
    expect(result).toEqual(mockResponse);
  });

  it('should throw error if response is missing puzzles property', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({total: 0});

    const query = {page: 1, pageSize: 10, filter: {sizeFilter: {Mini: false, Standard: false}}};

    await expect(fetchPuzzleList(query)).rejects.toThrow('Invalid response format');
  });
});
