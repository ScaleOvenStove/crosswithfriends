import {renderHook, waitFor, act} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useRoom} from '../../hooks/useRoom';

// Mock emitAsync
const mockEmitAsync = vi.fn();
vi.mock('../../sockets/emitAsync', () => ({
  emitAsync: (...args: unknown[]) => mockEmitAsync(...args),
}));

// Mock useSocket
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

const mockUseSocket = vi.fn(() => mockSocket);
vi.mock('../../sockets/useSocket', () => ({
  useSocket: () => mockUseSocket(),
}));

// Mock useUser
const mockUseUser = {
  id: 'test-user-id',
  color: '#ff0000',
  fb: null,
  attached: true,
  attach: vi.fn(),
  logIn: vi.fn(),
  listUserHistory: vi.fn(),
  listCompositions: vi.fn(),
  joinComposition: vi.fn(),
  joinGame: vi.fn(),
  markSolved: vi.fn(),
  recordUsername: vi.fn(),
  onAuth: vi.fn(() => () => {}),
};

vi.mock('../../hooks/useUser', () => ({
  useUser: () => mockUseUser,
}));

describe('useRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock - will be overridden by test-specific mocks
    mockEmitAsync.mockReset();
    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'room_event') {
        // Store callback for later use
        vi.mocked(mockSocket).roomEventCallback = callback;
      }
    });
  });

  it('should initialize with empty events', async () => {
    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(() => {
      expect(result.current.events).toEqual([]);
      expect(result.current.loading).toBe(true);
    });
  });

  it('should subscribe to room events', async () => {
    mockEmitAsync.mockResolvedValueOnce(undefined); // join_room
    mockEmitAsync.mockResolvedValueOnce([]); // sync_all_room_events

    renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(() => {
      expect(mockEmitAsync).toHaveBeenCalledWith(mockSocket, 'join_room', 'test-room');
      expect(mockEmitAsync).toHaveBeenCalledWith(mockSocket, 'sync_all_room_events', 'test-room');
    });
  });

  it('should sync all room events on mount', async () => {
    const mockEvents = [
      {type: 'userPing', params: {userId: 'user1'}},
      {type: 'setGame', params: {gid: 'game1'}},
    ];

    mockEmitAsync.mockImplementationOnce(async () => {
      // join_room
      return undefined;
    });
    mockEmitAsync.mockImplementationOnce(async () => {
      // sync_all_room_events - resolve after a delay to simulate async
      await new Promise((resolve) => setTimeout(resolve, 10));
      return mockEvents;
    });

    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(
      () => {
        expect(result.current.events).toEqual(mockEvents);
        expect(result.current.loading).toBe(false);
      },
      {timeout: 2000}
    );
  });

  it('should add new events when room_event is received', async () => {
    let roomEventCallback: ((event: unknown) => void) | null = null;

    mockEmitAsync.mockImplementation(async (socket, event) => {
      if (event === 'sync_all_room_events') {
        return [];
      }
      return undefined;
    });

    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'room_event') {
        roomEventCallback = callback;
      }
    });

    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      {timeout: 2000}
    );

    // Wait a bit for the connection to be established
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate receiving a new event
    const newEvent = {type: 'userPing', params: {userId: 'user2'}};
    if (roomEventCallback) {
      await act(async () => {
        roomEventCallback(newEvent);
        // Allow React to process the state update
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    await waitFor(
      () => {
        expect(result.current.events).toContainEqual(newEvent);
      },
      {timeout: 1000}
    );
  });

  it('should call onEventsChange when events change', async () => {
    const onEventsChange = vi.fn();
    mockEmitAsync.mockResolvedValueOnce(undefined); // join_room
    mockEmitAsync.mockResolvedValueOnce([]); // sync_all_room_events

    renderHook(() => useRoom({rid: 'test-room', onEventsChange}));

    await waitFor(() => {
      expect(onEventsChange).toHaveBeenCalled();
    });
  });

  it('should send user ping', async () => {
    mockEmitAsync.mockImplementation(async (socket, event) => {
      if (event === 'sync_all_room_events') {
        return [];
      }
      return undefined;
    });

    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      {timeout: 2000}
    );

    await result.current.sendUserPing();

    expect(mockEmitAsync).toHaveBeenLastCalledWith(
      mockSocket,
      'room_event',
      expect.objectContaining({
        rid: 'test-room',
        event: expect.objectContaining({
          type: 'USER_PING',
          uid: 'test-user-id',
        }),
      })
    );
  });

  it('should set game', async () => {
    mockEmitAsync.mockImplementation(async (socket, event) => {
      if (event === 'sync_all_room_events') {
        return [];
      }
      return undefined;
    });

    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      {timeout: 2000}
    );

    await result.current.setGame('game-123');

    expect(mockEmitAsync).toHaveBeenLastCalledWith(
      mockSocket,
      'room_event',
      expect.objectContaining({
        rid: 'test-room',
        event: expect.objectContaining({
          type: 'SET_GAME',
          uid: 'test-user-id',
          params: expect.objectContaining({
            gid: 'game-123',
          }),
        }),
      })
    );
  });

  it('should handle errors during sync', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockEmitAsync.mockImplementation(async (_socket, event) => {
      if (event === 'join_room') {
        return undefined;
      }
      if (event === 'sync_all_room_events') {
        // reject
        throw new Error('Sync failed');
      }
      return undefined;
    });

    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(
      () => {
        expect(result.current.error).toBeDefined();
        expect(result.current.loading).toBe(false);
      },
      {timeout: 2000}
    );

    consoleErrorSpy.mockRestore();
  });

  it('should cleanup subscriptions on unmount', async () => {
    mockEmitAsync.mockImplementation(async (_socket, event) => {
      if (event === 'join_room') {
        return undefined;
      }
      if (event === 'sync_all_room_events') {
        return [];
      }
      // leave_room
      return undefined;
    });

    const {result, unmount} = renderHook(() => useRoom({rid: 'test-room'}));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      {timeout: 2000}
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('room_event', expect.any(Function));
    expect(mockEmitAsync).toHaveBeenCalledWith(mockSocket, 'leave_room', 'test-room');
  });

  it('should not subscribe if socket is not available', () => {
    mockUseSocket.mockReturnValueOnce(undefined);

    const {result} = renderHook(() => useRoom({rid: 'test-room'}));

    expect(mockEmitAsync).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
  });
});
