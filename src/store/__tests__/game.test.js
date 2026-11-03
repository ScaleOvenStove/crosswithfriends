import {vi} from 'vitest';

// Stub socket before importing Game
const mockSocket = {
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
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
import {emitAsync, emitAsyncWithTimeout} from '../../sockets/emitAsync';

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

    // 2 calls: join_game (from the implicit connectToWebsocket) + game_event
    expect(emitAsyncWithTimeout).toHaveBeenCalledTimes(2);
    expect(emitAsyncWithTimeout.mock.calls.some((c) => c[2] === 'game_event')).toBe(true);
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
    emitAsyncWithTimeout.mockClear(); // discard the implicit join_game emit

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
    emitAsyncWithTimeout.mockClear(); // discard the implicit join_game emit

    await game.flushOfflineQueue();

    expect(emitAsyncWithTimeout).not.toHaveBeenCalled();
  });

  it('prevents concurrent flushes', async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    emitAsyncWithTimeout.mockClear(); // discard the implicit join_game emit

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
    emitAsyncWithTimeout.mockClear(); // discard the implicit join_game emit

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

// ---- Concurrent direct sends ----

describe('events whose direct sends time out together', () => {
  afterEach(() => {
    emitAsyncWithTimeout.mockImplementation(() => Promise.resolve());
  });

  // Two keystrokes inside one ack timeout both read an empty queue and go
  // straight to the socket. When both acks time out, each saves itself to the
  // queue — and before the fix the second saved the empty queue it read
  // before sending, overwriting the first. The lost event never echoed back,
  // so its optimistic copy froze that cell.
  it('queues both instead of the later one overwriting the earlier', async () => {
    const game = makeGame();
    await game.connectToWebsocket();

    const rejects = [];
    emitAsyncWithTimeout.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejects.push(reject);
        })
    );

    const first = game.addEvent({type: 'updateCell', timestamp: 1, params: {value: 'L'}});
    const second = game.addEvent({type: 'updateCell', timestamp: 2, params: {value: 'E'}});
    await vi.waitFor(() => expect(rejects).toHaveLength(2));

    // From here on every send (the flush retries) fails immediately.
    emitAsyncWithTimeout.mockImplementation(() => Promise.reject(new Error('offline')));
    rejects[0](new Error('timeout'));
    await first;
    rejects[1](new Error('timeout'));
    await second;

    const queue = JSON.parse(localStorage.getItem('offline_queue_test-123'));
    expect(queue.map((e) => e.params.value)).toEqual(['L', 'E']);
  });

  it('reports sent-but-unacked and queued events as pending', async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    let resolveSend;
    emitAsyncWithTimeout.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );
    const sending = game.addEvent({type: 'updateCell', timestamp: 1});
    await vi.waitFor(() => expect(resolveSend).toBeDefined());
    localStorage.setItem('offline_queue_test-123', JSON.stringify([{id: 'queued', type: 'updateCell'}]));

    expect(game.pendingEventIds().size).toBe(2);

    resolveSend();
    await sending;
    expect([...game.pendingEventIds()]).toEqual(['queued']);
  });
});

// ---- Reconnect resync ----

describe('reconnect after the initial sync', () => {
  afterEach(() => {
    emitAsync.mockImplementation((_socket, ...args) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') return Promise.resolve(cb());
      return Promise.resolve();
    });
  });

  function connectHandler() {
    const call = mockSocket.on.mock.calls.filter((c) => c[0] === 'connect').pop();
    return call[1];
  }

  it('replays events other players made while this client was disconnected', async () => {
    const game = makeGame();
    const history = [
      {id: 'c', type: 'create', timestamp: 0, params: {}},
      {id: 'a', type: 'updateCell', timestamp: 1, params: {value: 'A'}},
    ];
    emitAsync.mockImplementation((_socket, name) =>
      Promise.resolve(name === 'sync_all_game_events' ? history : undefined)
    );
    await game.attach();

    const seen = [];
    game.on('wsEvent', (e) => seen.push(e.id));
    game.on('wsCreateEvent', (e) => seen.push(e.id));

    // Someone else typed while this socket was out of the room, and an old
    // id-less event is in history too.
    history.push({id: 'b', type: 'updateCell', timestamp: 2, params: {value: 'B'}});
    history.push({type: 'updateCell', timestamp: 3, params: {value: 'C'}});
    await connectHandler()();

    // 'a' is re-emitted and deduped by HistoryWrapper; create and the id-less
    // event are skipped so neither is applied twice.
    expect(seen).toEqual(['a', 'b']);
  });

  // Another tab on the same game flushed an event this tab queued (the
  // offline queue is shared through localStorage), so only that tab saw the
  // echo. The resync has to bring it into history before 'reconnect' fires,
  // or the page's cleanup of unconfirmed optimistic events drops a letter
  // the server accepted.
  it('replays history before emitting reconnect', async () => {
    const game = makeGame();
    const history = [{id: 'c', type: 'create', timestamp: 0, params: {}}];
    emitAsync.mockImplementation((_socket, name) =>
      Promise.resolve(name === 'sync_all_game_events' ? history : undefined)
    );
    await game.attach();

    const order = [];
    game.on('wsEvent', (e) => order.push(e.id));
    game.on('reconnect', () => order.push('reconnect'));
    history.push({id: 'flushed-by-other-tab', type: 'updateCell', timestamp: 1, params: {}});
    await connectHandler()();

    expect(order).toEqual(['flushed-by-other-tab', 'reconnect']);
  });

  it('does not replay history over a game loaded from a solved snapshot', async () => {
    const game = makeGame();
    let history = [{id: 'c', type: 'create', timestamp: 0, params: {game: {solved: true}}}];
    emitAsync.mockImplementation((_socket, name) =>
      Promise.resolve(name === 'sync_all_game_events' ? history : undefined)
    );
    await game.attach();

    const seen = [];
    game.on('wsEvent', (e) => seen.push(e.id));
    // Someone chose to keep the replay, so the server now returns the full log.
    history = [
      {id: 'c', type: 'create', timestamp: 0, params: {game: {}}},
      {id: 'chat-1', type: 'chat', timestamp: 1, params: {}},
    ];
    await connectHandler()();

    expect(seen).toEqual([]);
  });

  it('does not report gameNotFound on a resync', async () => {
    const game = makeGame();
    emitAsync.mockImplementation((_socket, name) =>
      Promise.resolve(name === 'sync_all_game_events' ? [{id: 'c', type: 'create', params: {}}] : undefined)
    );
    await game.attach();
    const notFound = vi.fn();
    game.on('gameNotFound', notFound);
    emitAsync.mockImplementation((_socket, name) =>
      Promise.resolve(name === 'sync_all_game_events' ? [] : undefined)
    );
    await connectHandler()();
    expect(notFound).not.toHaveBeenCalled();
  });
});

// ---- Detach ----

describe('detach', () => {
  it("removes its handlers from the shared socket and leaves the game's room", async () => {
    const game = makeGame();
    await game.connectToWebsocket();
    const registered = mockSocket.on.mock.calls.map(([name, handler]) => [name, handler]);
    const pageListener = vi.fn();
    game.on('wsEvent', pageListener);

    game.detach();

    expect(mockSocket.off.mock.calls).toEqual(registered);
    expect(registered.map(([name]) => name)).toEqual(expect.arrayContaining(['connect', 'game_event']));
    expect(mockSocket.emit).toHaveBeenCalledWith('leave_game', 'test-123');
    // Anything already in flight (a reconnect resync) has no one to reach.
    game.emitWSEvent({id: 'old-game-event', type: 'updateCell'});
    expect(pageListener).not.toHaveBeenCalled();
  });

  it('registers nothing when detached before the socket resolves', async () => {
    const game = makeGame();
    const connecting = game.connectToWebsocket();
    game.detach();
    await connecting;

    expect(mockSocket.on).not.toHaveBeenCalled();
    expect(game.socket).toBeUndefined();
  });
});
