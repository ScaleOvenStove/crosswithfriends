import {describe, it, expect, vi, beforeEach} from 'vitest';

import apiClient from '../../api/client';
import {incrementGid, incrementPid} from '../../api/counters';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('counters API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('incrementGid', () => {
    it('should call apiClient.post with correct parameters', async () => {
      const mockResponse = {gid: 'test-gid'};
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await incrementGid();

      expect(apiClient.post).toHaveBeenCalledWith('/api/counters/gid', {});
      expect(result).toEqual(mockResponse);
    });
  });

  describe('incrementPid', () => {
    it('should call apiClient.post with correct parameters', async () => {
      const mockResponse = {pid: '123'};
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await incrementPid();

      expect(apiClient.post).toHaveBeenCalledWith('/api/counters/pid', {});
      expect(result).toEqual(mockResponse);
    });
  });
});
