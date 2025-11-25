import {describe, it, expect, vi, beforeEach} from 'vitest';

import apiClient from '../../api/client';
import {createNewPuzzle, recordSolve} from '../../api/puzzle';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('puzzle API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNewPuzzle', () => {
    it('should call apiClient.post with correct parameters', async () => {
      const mockResponse = {pid: 'test-puzzle-id'};
      (apiClient.post as any).mockResolvedValue(mockResponse);

      const puzzle = {title: 'Test Puzzle', author: 'Test Author'};
      const result = await createNewPuzzle(puzzle, '123', {isPublic: true});

      expect(apiClient.post).toHaveBeenCalledWith('/api/puzzle', {
        puzzle,
        pid: '123',
        isPublic: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default isPublic value when not provided', async () => {
      const mockResponse = {pid: 'test-puzzle-id'};
      (apiClient.post as any).mockResolvedValue(mockResponse);

      const puzzle = {title: 'Test Puzzle', author: 'Test Author'};
      await createNewPuzzle(puzzle);

      expect(apiClient.post).toHaveBeenCalledWith('/api/puzzle', {
        puzzle,
        pid: undefined,
        isPublic: false,
      });
    });
  });

  describe('recordSolve', () => {
    it('should call apiClient.post with correct parameters', async () => {
      const mockResponse = {success: true};
      (apiClient.post as any).mockResolvedValue(mockResponse);

      const result = await recordSolve('123', 'game-456', 1000);

      expect(apiClient.post).toHaveBeenCalledWith('/api/record_solve/123', {
        gid: 'game-456',
        time_to_solve: 1000,
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
