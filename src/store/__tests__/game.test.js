import {vi} from 'vitest';

// Stub socket before importing Game
const mockSocket = {
  connected: true,
  on: vi.fn(),
  once: vi.fn(),
  emit: vi.fn((...args) => {
    // auto-ack
    const cb = args[args.length - 1];
    if (typeof cb === 'function') cb();
  }),
};

vi.mock('../../sockets/getSocket', () => ({
  getSocket: vi.fn(() => Promise.resolve(mockSocket)),
}));

vi.mock('../../sockets/emitAsync', () => ({
  emitAsync: vi.fn((_socket, ...args) => {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') return Promise.resolve(cb());
    return Promise.resolve();
  }),
  emitAsyncWithTimeout: vi.fn((_socket, _timeout, ..._args) => {
    return Promise.resolve();
  }),
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

import Game from '../game';
import {emitAsyncWithTimeout} from '../../sockets/emitAsync';

function makeGame() {
  const game = new Game('/game/test-123');
  return game;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockSocket.connected = true;
});

// ---- Offline queue persistence ----

describe('offline event queue', () => {
  it('sends event directly when socket is connected', async () => {
    const game = makeGame();
    await game.addEvent({type: 'updateCell', timestamp: 1});

    expect(emitAsyncWithTimeout).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('offline_queue_test-123')).toBeNull();
  });

  it('queues event to localStorage when socket is disconnected', async () => {
    const game = makeGame();
    // Connect first so socket is assigned, then disconnect
    await game.connectToWebsocket();
    mockSocket.connected = false;

    await game.addEvent({type: 'updateCell', timestamp: 1});

    const queue = JSON.parse(localStorage.getItem('offline_queue_test-123'));
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('updateCell');
  });

  it('queues multiple events while offline', async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    mockSocket.connected = false;

    await game.addEvent({type: 'updateCell', timestamp: 1});
    await game.addEvent({type: 'updateCell', timestamp: 2});
    await game.addEvent({type: 'updateCell', timestamp: 3});

    const queue = JSON.parse(localStorage.getItem('offline_queue_test-123'));
    expect(queue).toHaveLength(3);
  });

  it('assigns unique IDs to each event', async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    mockSocket.connected = false;

    await game.addEvent({type: 'updateCell', timestamp: 1});
    await game.addEvent({type: 'updateCell', timestamp: 2});

    const queue = JSON.parse(localStorage.getItem('offline_queue_test-123'));
    expect(queue[0].id).toBeDefined();
    expect(queue[1].id).toBeDefined();
    expect(queue[0].id).not.toBe(queue[1].id);
  });

  it('sets syncState to retrying when event is queued', async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    mockSocket.connected = false;

    const warnings = [];
    game.on('syncWarning', (info) => warnings.push(info));

    await game.addEvent({type: 'updateCell', timestamp: 1});

    expect(game.syncState).toBe('retrying');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].level).toBe('retrying');
  });

  it('keeps separate queues per game', async () => {
    const game1 = new Game('/game/aaa');
    const game2 = new Game('/game/bbb');
    await game1.connectToWebsocket();
    await game2.connectToWebsocket();
    mockSocket.connected = false;

    await game1.addEvent({type: 'updateCell', timestamp: 1});
    await game2.addEvent({type: 'updateCell', timestamp: 2});
    await game2.addEvent({type: 'updateCell', timestamp: 3});

    expect(JSON.parse(localStorage.getItem('offline_queue_aaa'))).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('offline_queue_bbb'))).toHaveLength(2);
  });

  it('appends to queue instead of sending directly when queue is non-empty', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    // Seed an existing queued event
    localStorage.setItem(
      'offline_queue_test-123',
      JSON.stringify([{id: 'old', type: 'updateCell', timestamp: 1}])
    );

    // Make flush fail so events stay in the queue for inspection
    emitAsyncWithTimeout.mockImplementation(() => Promise.reject(new Error('offline')));

    await game.addEvent({type: 'updateCell', timestamp: 2});

    const queue = JSON.parse(localStorage.getItem('offline_queue_test-123'));
    expect(queue[0].id).toBe('old');
    expect(queue[1].type).toBe('updateCell');
    expect(queue[1].timestamp).toBe(2);

    // Restore default mock
    emitAsyncWithTimeout.mockImplementation(() => Promise.resolve());
  });
});

// ---- Flush ----

describe('flushOfflineQueue', () => {
  it('sends all queued events and clears localStorage', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    // Seed the queue as if we were offline earlier
    localStorage.setItem(
      'offline_queue_test-123',
      JSON.stringify([
        {id: 'e1', type: 'updateCell', timestamp: 1},
        {id: 'e2', type: 'updateCell', timestamp: 2},
      ])
    );

    mockSocket.connected = true;
    await game.flushOfflineQueue();

    expect(emitAsyncWithTimeout).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('offline_queue_test-123')).toBeNull();
    expect(game.syncState).toBeNull();
  });

  it('stops on first failure and keeps remaining events in queue', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    localStorage.setItem(
      'offline_queue_test-123',
      JSON.stringify([
        {id: 'e1', type: 'updateCell', timestamp: 1},
        {id: 'e2', type: 'updateCell', timestamp: 2},
        {id: 'e3', type: 'updateCell', timestamp: 3},
      ])
    );

    // Fail on the second event
    let callCount = 0;
    emitAsyncWithTimeout.mockImplementation(() => {
      callCount += 1;
      if (callCount === 2) return Promise.reject(new Error('timeout'));
      return Promise.resolve();
    });

    mockSocket.connected = true;
    await game.flushOfflineQueue();

    // Should have stopped at e2, leaving e2 and e3 in the queue
    const remaining = JSON.parse(localStorage.getItem('offline_queue_test-123'));
    expect(remaining).toHaveLength(2);
    expect(remaining[0].id).toBe('e2');
    expect(remaining[1].id).toBe('e3');
    expect(game.syncState).toBe('retrying');

    emitAsyncWithTimeout.mockImplementation(() => Promise.resolve());
  });

  it('does nothing when queue is empty', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    await game.flushOfflineQueue();

    expect(emitAsyncWithTimeout).not.toHaveBeenCalled();
  });

  it('prevents concurrent flushes', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    localStorage.setItem(
      'offline_queue_test-123',
      JSON.stringify([{id: 'e1', type: 'updateCell', timestamp: 1}])
    );

    // Start two flushes at the same time
    mockSocket.connected = true;
    const p1 = game.flushOfflineQueue();
    const p2 = game.flushOfflineQueue();
    await Promise.all([p1, p2]);

    // Should only have sent the event once
    expect(emitAsyncWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not lose events appended during flush', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    localStorage.setItem(
      'offline_queue_test-123',
      JSON.stringify([{id: 'e1', type: 'updateCell', timestamp: 1}])
    );

    // While flushing e1, simulate a concurrent addEvent writing e2 to localStorage
    emitAsyncWithTimeout.mockImplementation(() => {
      const queue = JSON.parse(localStorage.getItem('offline_queue_test-123')) || [];
      if (!queue.some((e) => e.id === 'e2')) {
        queue.push({id: 'e2', type: 'updateCell', timestamp: 2});
        localStorage.setItem('offline_queue_test-123', JSON.stringify(queue));
      }
      return Promise.resolve();
    });

    mockSocket.connected = true;
    await game.flushOfflineQueue();

    // e1 should have been sent and removed, e2 should also have been sent
    expect(localStorage.getItem('offline_queue_test-123')).toBeNull();
    expect(emitAsyncWithTimeout).toHaveBeenCalledTimes(2);

    emitAsyncWithTimeout.mockImplementation(() => Promise.resolve());
  });
});

// ---- Optimistic events ----

describe('optimistic events', () => {
  it('emits wsOptimisticEvent even when offline', async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    mockSocket.connected = false;

    const optimistic = [];
    game.on('wsOptimisticEvent', (e) => optimistic.push(e));

    await game.addEvent({type: 'updateCell', timestamp: 1});

    expect(optimistic).toHaveLength(1);
    expect(optimistic[0].type).toBe('updateCell');
  });
});
