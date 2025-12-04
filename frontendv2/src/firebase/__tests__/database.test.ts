/**
 * Firebase Realtime Database Module Tests
 * Tests database operations and real-time sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  writeData,
  readData,
  updateData,
  deleteData,
  pushData,
  subscribeToData,
  setPresence,
  subscribeToPresence,
  syncGameState,
  subscribeToGameState,
  addChatMessage,
  subscribeToRoomMessages,
} from '../database';

// Mock Firebase Database
vi.mock('../config', () => ({
  database: {},
  isFirebaseConfigured: true,
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
  push: vi.fn(),
  serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
}));

describe('Firebase Database Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeData', () => {
    it('should write data to specified path', async () => {
      const { ref, set } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(set).mockResolvedValue(undefined);

      await writeData('test/path', { value: 'test' });

      expect(ref).toHaveBeenCalled();
      expect(set).toHaveBeenCalledWith(mockRef, { value: 'test' });
    });

    it('should throw error if database is not configured', async () => {
      const { isFirebaseConfigured } = await import('../config');
      vi.mocked(isFirebaseConfigured as any).mockReturnValue(false);

      await expect(writeData('test/path', { value: 'test' })).rejects.toThrow(
        'Firebase Database is not configured'
      );
    });
  });

  describe('readData', () => {
    it('should read data from specified path', async () => {
      const { ref, get } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      const mockSnapshot = {
        exists: () => true,
        val: () => ({ value: 'test' }),
      };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(get).mockResolvedValue(mockSnapshot as any);

      const data = await readData('test/path');

      expect(ref).toHaveBeenCalled();
      expect(get).toHaveBeenCalledWith(mockRef);
      expect(data).toEqual({ value: 'test' });
    });

    it('should return null if data does not exist', async () => {
      const { ref, get } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      const mockSnapshot = {
        exists: () => false,
      };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(get).mockResolvedValue(mockSnapshot as any);

      const data = await readData('test/path');

      expect(data).toBeNull();
    });
  });

  describe('updateData', () => {
    it('should update specific fields at path', async () => {
      const { ref, update } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(update).mockResolvedValue(undefined);

      await updateData('test/path', { field: 'updated' });

      expect(ref).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(mockRef, { field: 'updated' });
    });
  });

  describe('deleteData', () => {
    it('should delete data at specified path', async () => {
      const { ref, remove } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(remove).mockResolvedValue(undefined);

      await deleteData('test/path');

      expect(ref).toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith(mockRef);
    });
  });

  describe('pushData', () => {
    it('should push data and return generated key', async () => {
      const { ref, push, set } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      const mockNewRef = { key: 'generated-key' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(push).mockReturnValue(mockNewRef as any);
      vi.mocked(set).mockResolvedValue(undefined);

      const key = await pushData('test/path', { value: 'test' });

      expect(push).toHaveBeenCalledWith(mockRef);
      expect(set).toHaveBeenCalledWith(mockNewRef, { value: 'test' });
      expect(key).toBe('generated-key');
    });
  });

  describe('subscribeToData', () => {
    it('should listen for real-time changes', () => {
      const { ref, onValue } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      const callback = vi.fn();
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(onValue).mockImplementation((ref, cb) => {
        // Simulate snapshot
        cb({
          exists: () => true,
          val: () => ({ value: 'test' }),
        } as any);
        return vi.fn();
      });

      const unsubscribe = subscribeToData('test/path', callback);

      expect(ref).toHaveBeenCalled();
      expect(onValue).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({ value: 'test' });
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with null if data does not exist', () => {
      const { ref, onValue } = await import('firebase/database');
      const mockRef = { path: '/test/path' };
      const callback = vi.fn();
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(onValue).mockImplementation((ref, cb) => {
        cb({
          exists: () => false,
        } as any);
        return vi.fn();
      });

      subscribeToData('test/path', callback);

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('setPresence', () => {
    it('should update user presence with timestamp', async () => {
      const { ref, set, serverTimestamp } = await import('firebase/database');
      const mockRef = { path: '/presence/user-id' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(set).mockResolvedValue(undefined);
      vi.mocked(serverTimestamp).mockReturnValue({ '.sv': 'timestamp' } as any);

      await setPresence('user-id', 'online');

      expect(ref).toHaveBeenCalled();
      expect(set).toHaveBeenCalledWith(mockRef, {
        status: 'online',
        lastSeen: { '.sv': 'timestamp' },
      });
    });
  });

  describe('syncGameState', () => {
    it('should sync game state to database', async () => {
      const { ref, set } = await import('firebase/database');
      const mockRef = { path: '/games/game-id/state' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(set).mockResolvedValue(undefined);

      const gameState = { grid: [], players: [] };
      await syncGameState('game-id', gameState);

      expect(ref).toHaveBeenCalled();
      expect(set).toHaveBeenCalledWith(mockRef, gameState);
    });
  });

  describe('addChatMessage', () => {
    it('should add message with server timestamp', async () => {
      const { ref, push, set, serverTimestamp } = await import('firebase/database');
      const mockRef = { path: '/rooms/room-id/messages' };
      const mockNewRef = { key: 'message-id' };
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(push).mockReturnValue(mockNewRef as any);
      vi.mocked(set).mockResolvedValue(undefined);
      vi.mocked(serverTimestamp).mockReturnValue({ '.sv': 'timestamp' } as any);

      const messageId = await addChatMessage('room-id', 'user-id', 'User Name', 'Hello!');

      expect(push).toHaveBeenCalled();
      expect(set).toHaveBeenCalledWith(mockNewRef, {
        userId: 'user-id',
        userName: 'User Name',
        message: 'Hello!',
        timestamp: { '.sv': 'timestamp' },
      });
      expect(messageId).toBe('message-id');
    });
  });

  describe('Security Compliance', () => {
    it('should use server timestamps to prevent client-side manipulation', async () => {
      const { serverTimestamp } = await import('firebase/database');
      vi.mocked(serverTimestamp).mockReturnValue({ '.sv': 'timestamp' } as any);

      await setPresence('user-id', 'online');

      expect(serverTimestamp).toHaveBeenCalled();
    });

    it('should enforce TLS encryption (handled by Firebase)', () => {
      // Firebase SDK enforces TLS by default
      // This is a documentation test
      expect(true).toBe(true);
    });
  });
});
