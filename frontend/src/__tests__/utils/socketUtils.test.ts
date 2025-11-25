import {describe, it, expect, vi} from 'vitest';

import {emitAsync, onceAsync} from '../../sockets/emitAsync';
import {getSocket} from '../../sockets/getSocket';
import socketManager from '../../sockets/SocketManager';

// Mock SocketManager
vi.mock('../../sockets/SocketManager', () => {
  const mockSocket = {
    emit: vi.fn((_event, _data, callback) => {
      if (callback) callback();
    }),
    once: vi.fn((_event, callback) => {
      if (callback) callback('test-data');
    }),
    on: vi.fn(),
    off: vi.fn(),
    connected: true,
  };

  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockSocket),
      getSocket: vi.fn(() => mockSocket),
      emitAsync: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
      isConnected: vi.fn(() => true),
    },
  };
});

describe('emitAsync', () => {
  it('should emit event and return promise that resolves on acknowledgment', async () => {
    const mockSocket = {
      emit: vi.fn((_event, _data, callback) => {
        if (callback) callback();
      }),
    } as any;

    const promise = emitAsync(mockSocket, 'test_event', {data: 'test'});

    await expect(promise).resolves.toBeUndefined();
    expect(mockSocket.emit).toHaveBeenCalledWith('test_event', {data: 'test'}, expect.any(Function));
  });

  it('should handle multiple arguments', async () => {
    const mockSocket = {
      emit: vi.fn((_event, _arg1, _arg2, callback) => {
        if (callback) callback();
      }),
    } as any;

    const promise = emitAsync(mockSocket, 'test_event', 'arg1', 'arg2');

    await expect(promise).resolves.toBeUndefined();
    expect(mockSocket.emit).toHaveBeenCalledWith('test_event', 'arg1', 'arg2', expect.any(Function));
  });
});

describe('onceAsync', () => {
  it('should listen for event once and return promise with data', async () => {
    const mockSocket = {
      once: vi.fn((_event, callback) => {
        callback('test-data');
      }),
    } as any;

    const promise = onceAsync(mockSocket, 'test_event');

    await expect(promise).resolves.toBe('test-data');
    expect(mockSocket.once).toHaveBeenCalledWith('test_event', expect.any(Function));
  });
});

describe('getSocket', () => {
  it('should return socket from SocketManager', async () => {
    const socket = await getSocket();

    expect(socket).toBeDefined();
    expect(socketManager.connect).toHaveBeenCalled();
  });
});
