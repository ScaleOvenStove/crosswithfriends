import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest';
import * as countersModel from '../../model/counters.js';
import {pool} from '../../model/pool.js';

// Mock the database pool
vi.mock('../../model/pool.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('Counters Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('incrementGid', () => {
    it('should increment and return gid', async () => {
      const mockGid = '123';
      (pool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockGid}],
      });

      const gid = await countersModel.incrementGid();

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT nextval('gid_counter')"));
      expect(gid).toBe(mockGid);
    });

    it('should throw error when database returns no rows', async () => {
      (pool.query as Mock).mockResolvedValue({rows: []});

      await expect(countersModel.incrementGid()).rejects.toThrow('Failed to increment GID');
    });

    it('should handle numeric gid values', async () => {
      const mockGid = 456;
      (pool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockGid}],
      });

      const gid = await countersModel.incrementGid();
      // The function casts to string, so it returns the number as-is but typed as string
      expect(String(gid)).toBe(String(mockGid));
    });
  });

  describe('incrementPid', () => {
    it('should increment and return pid', async () => {
      const mockPid = '789';
      (pool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockPid}],
      });

      const pid = await countersModel.incrementPid();

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT nextval('pid_counter')"));
      expect(pid).toBe(mockPid);
    });

    it('should throw error when database returns no rows', async () => {
      (pool.query as Mock).mockResolvedValue({rows: []});

      await expect(countersModel.incrementPid()).rejects.toThrow('Failed to increment PID');
    });

    it('should handle numeric pid values', async () => {
      const mockPid = 999;
      (pool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockPid}],
      });

      const pid = await countersModel.incrementPid();
      // The function casts to string, so it returns the number as-is but typed as string
      expect(String(pid)).toBe(String(mockPid));
    });
  });
});
