import {describe, it, expect, vi, beforeEach} from 'vitest';

import {emitAsync, onceAsync} from '../../sockets/emitAsync';
import {createMockSocket, triggerSocketEvent, type MockSocket} from '../mocks/socket';

describe('emitAsync', () => {
  let mockSocket: MockSocket;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  it('should emit event and resolve when acknowledged', async () => {
    const promise = emitAsync(mockSocket as any, 'test-event', 'data1', 'data2');

    // The mock socket should have called emit
    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', 'data1', 'data2', expect.any(Function));

    // The promise should resolve (mock automatically calls the callback)
    await expect(promise).resolves.toBeUndefined();
  });

  it('should pass multiple arguments to emit', async () => {
    await emitAsync(mockSocket as any, 'join-game', 'game-id', {option: 'value'});

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'join-game',
      'game-id',
      {option: 'value'},
      expect.any(Function)
    );
  });

  it('should handle events with no data', async () => {
    await emitAsync(mockSocket as any, 'ping');

    expect(mockSocket.emit).toHaveBeenCalledWith('ping', expect.any(Function));
  });
});

describe('onceAsync', () => {
  let mockSocket: MockSocket;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  it('should listen for event once and resolve with data', async () => {
    const promise = onceAsync(mockSocket as any, 'test-event');

    // Trigger the event
    if (mockSocket._callbacks['test-event']) {
      mockSocket._callbacks['test-event'][0]('event-data');
    }

    await expect(promise).resolves.toBe('event-data');
  });

  it('should resolve with multiple arguments', async () => {
    const promise = onceAsync(mockSocket as any, 'test-event');

    // Trigger the event with multiple args
    if (mockSocket._callbacks['test-event']) {
      mockSocket._callbacks['test-event'][0]('arg1', 'arg2', {data: 'value'});
    }

    const result = await promise;
    expect(result).toBe('arg1');
  });

  it('should only listen once', async () => {
    const promise = onceAsync(mockSocket as any, 'test-event');

    // First trigger
    if (mockSocket._callbacks['test-event']) {
      mockSocket._callbacks['test-event'][0]('first');
    }

    await promise;

    // Second trigger should not affect anything (listener was removed)
    expect(mockSocket._callbacks['test-event']?.length || 0).toBe(0);
  });

  it('should handle different event types', async () => {
    const connectPromise = onceAsync(mockSocket as any, 'connect');
    const disconnectPromise = onceAsync(mockSocket as any, 'disconnect');

    // Trigger the events using the helper function
    triggerSocketEvent(mockSocket, 'connect', 'connect-data');
    triggerSocketEvent(mockSocket, 'disconnect', 'disconnect-data');

    const connectResult = await connectPromise;
    const disconnectResult = await disconnectPromise;

    expect(connectResult).toBe('connect-data');
    expect(disconnectResult).toBe('disconnect-data');
  });
});
