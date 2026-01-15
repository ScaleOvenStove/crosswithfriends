import type {Pool} from 'pg';
import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest';
import * as countersModel from '../../model/counters.js';

const mockPool = {
  query: vi.fn(),
  connect: vi.fn(),
} as unknown as Pool;

describe('Counters Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('incrementGid', () => {
    it('should increment and return gid', async () => {
      const mockGid = '123';
      (mockPool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockGid}],
      });

      const gid = await countersModel.incrementGid(mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT nextval('gid_counter')"));
      expect(gid).toBe(mockGid);
    });

    it('should throw error when database returns no rows', async () => {
      (mockPool.query as Mock).mockResolvedValue({rows: []});

      await expect(countersModel.incrementGid(mockPool)).rejects.toThrow('Failed to increment GID');
    });

    it('should handle numeric gid values', async () => {
      const mockGid = 456;
      (mockPool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockGid}],
      });

      const gid = await countersModel.incrementGid(mockPool);
      // The function casts to string, so it returns the number as-is but typed as string
      expect(String(gid)).toBe(String(mockGid));
    });
  });

  describe('incrementPid', () => {
    it('should increment and return pid', async () => {
      const mockPid = '789';
      (mockPool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockPid}],
      });

      const pid = await countersModel.incrementPid(mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT nextval('pid_counter')"));
      expect(pid).toBe(mockPid);
    });

    it('should throw error when database returns no rows', async () => {
      (mockPool.query as Mock).mockResolvedValue({rows: []});

      await expect(countersModel.incrementPid(mockPool)).rejects.toThrow('Failed to increment PID');
    });

    it('should handle numeric pid values', async () => {
      const mockPid = 999;
      (mockPool.query as Mock).mockResolvedValue({
        rows: [{nextval: mockPid}],
      });

      const pid = await countersModel.incrementPid(mockPool);
      // The function casts to string, so it returns the number as-is but typed as string
      expect(String(pid)).toBe(String(mockPid));
    });
  });
});
