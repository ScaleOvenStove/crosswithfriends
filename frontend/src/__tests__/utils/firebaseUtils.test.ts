import {describe, it, expect} from 'vitest';

import {
  isValidFirebasePath,
  isValidGid,
  extractAndValidateGid,
  createSafePath,
} from '../../store/firebaseUtils';

describe('firebaseUtils', () => {
  describe('isValidFirebasePath', () => {
    it('should return true for valid paths', () => {
      expect(isValidFirebasePath('/game/123-abc')).toBe(true);
      expect(isValidFirebasePath('/game/test-game-id')).toBe(true);
      expect(isValidFirebasePath('/room/room123')).toBe(true);
      expect(isValidFirebasePath('game/123')).toBe(true);
    });

    it('should return false for paths with invalid characters', () => {
      expect(isValidFirebasePath('/game/test.game')).toBe(false);
      expect(isValidFirebasePath('/game/test$game')).toBe(false);
      expect(isValidFirebasePath('/game/test[game]')).toBe(false);
      expect(isValidFirebasePath('/game/test#game')).toBe(false);
      expect(isValidFirebasePath('/game/test.game')).toBe(false);
    });

    it('should return false for paths containing undefined or null', () => {
      expect(isValidFirebasePath('/game/undefined')).toBe(false);
      expect(isValidFirebasePath('/game/null')).toBe(false);
      expect(isValidFirebasePath('undefined/game')).toBe(false);
      expect(isValidFirebasePath('null/game')).toBe(false);
    });

    it('should return false for empty or invalid input', () => {
      expect(isValidFirebasePath('')).toBe(false);
      expect(isValidFirebasePath(null as any)).toBe(false);
      expect(isValidFirebasePath(undefined as any)).toBe(false);
      expect(isValidFirebasePath(123 as any)).toBe(false);
    });

    it('should allow forward slashes as path separators', () => {
      expect(isValidFirebasePath('/game/123/players')).toBe(true);
      expect(isValidFirebasePath('/game/123/players/user1')).toBe(true);
    });
  });

  describe('isValidGid', () => {
    it('should return true for valid game IDs', () => {
      expect(isValidGid('123-abc')).toBe(true);
      expect(isValidGid('test-game-id')).toBe(true);
      expect(isValidGid('game123')).toBe(true);
      expect(isValidGid('a')).toBe(true);
    });

    it('should return false for game IDs with invalid characters', () => {
      expect(isValidGid('test.game')).toBe(false);
      expect(isValidGid('test$game')).toBe(false);
      expect(isValidGid('test[game]')).toBe(false);
      expect(isValidGid('test#game')).toBe(false);
      expect(isValidGid('test/game')).toBe(false);
    });

    it('should return false for empty or invalid input', () => {
      expect(isValidGid('')).toBe(false);
      expect(isValidGid('   ')).toBe(false);
      expect(isValidGid(null as any)).toBe(false);
      expect(isValidGid(undefined as any)).toBe(false);
      expect(isValidGid(123 as any)).toBe(false);
    });
  });

  describe('extractAndValidateGid', () => {
    it('should extract and validate gid from valid game path', () => {
      expect(extractAndValidateGid('/game/123-abc')).toBe('123-abc');
      expect(extractAndValidateGid('/game/test-game-id')).toBe('test-game-id');
      expect(extractAndValidateGid('/game/game123')).toBe('game123');
    });

    it('should return null for invalid paths', () => {
      expect(extractAndValidateGid('/game/test.game')).toBe(null);
      expect(extractAndValidateGid('/game/test$game')).toBe(null);
      expect(extractAndValidateGid('/invalid/path')).toBe(null);
      expect(extractAndValidateGid('not-a-game-path')).toBe(null);
    });

    it('should return null for paths with invalid gid', () => {
      expect(extractAndValidateGid('/game/')).toBe(null);
      expect(extractAndValidateGid('/game/test.game')).toBe(null);
    });

    it('should return null for empty or invalid input', () => {
      expect(extractAndValidateGid('')).toBe(null);
      expect(extractAndValidateGid(null as any)).toBe(null);
      expect(extractAndValidateGid(undefined as any)).toBe(null);
    });
  });

  describe('createSafePath', () => {
    it('should create valid paths from base and key', () => {
      expect(createSafePath('/game', '123-abc')).toBe('/game/123-abc');
      expect(createSafePath('/game', 'test-game-id')).toBe('/game/test-game-id');
      expect(createSafePath('game', '123')).toBe('game/123');
    });

    it('should handle base paths with trailing slashes', () => {
      expect(createSafePath('/game/', '123-abc')).toBe('/game/123-abc');
      expect(createSafePath('game/', '123')).toBe('game/123');
    });

    it('should throw error for keys with leading slashes (validation happens before cleaning)', () => {
      // The function validates the key before cleaning, so keys with leading slashes are invalid
      expect(() => createSafePath('/game', '/123-abc')).toThrow('Invalid key');
      expect(() => createSafePath('game', '/123')).toThrow('Invalid key');
    });

    it('should throw error for invalid base path', () => {
      expect(() => createSafePath('/game.test', '123')).toThrow('Invalid base path');
      expect(() => createSafePath('/game$', '123')).toThrow('Invalid base path');
      expect(() => createSafePath('', '123')).toThrow('Invalid base path');
    });

    it('should throw error for invalid key', () => {
      expect(() => createSafePath('/game', 'test.game')).toThrow('Invalid key');
      expect(() => createSafePath('/game', 'test$game')).toThrow('Invalid key');
      expect(() => createSafePath('/game', '')).toThrow('Invalid key');
    });
  });
});
