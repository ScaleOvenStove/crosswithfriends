// Mock store/user to avoid Firebase import chain
jest.mock('../../../../src/store/user', () => ({
  getUser: () => ({id: 'mock-user'}),
}));

import {roomReducer, initialRoomState} from '../room';
import {RoomEventType, RoomEvent} from '../../../shared/roomEvents';

describe('initialRoomState', () => {
  it('has empty users and games arrays', () => {
    expect(initialRoomState.users).toEqual([]);
    expect(initialRoomState.games).toEqual([]);
  });
});

describe('USER_PING', () => {
  it('adds a new user with uid and lastPing timestamp', () => {
    const event: RoomEvent<RoomEventType.USER_PING> = {
      type: RoomEventType.USER_PING,
      params: {uid: 'user-1'},
      timestamp: 1000,
      uid: 'user-1',
    };
    const result = roomReducer(initialRoomState, event);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].uid).toBe('user-1');
    expect(result.users[0].lastPing).toBe(1000);
  });

  it('updates lastPing for existing user', () => {
    const state = {
      ...initialRoomState,
      users: [{uid: 'user-1', lastPing: 500}],
    };
    const event: RoomEvent<RoomEventType.USER_PING> = {
      type: RoomEventType.USER_PING,
      params: {uid: 'user-1'},
      timestamp: 2000,
      uid: 'user-1',
    };
    const result = roomReducer(state, event);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].lastPing).toBe(2000);
  });

  it('preserves other users when updating one', () => {
    const state = {
      ...initialRoomState,
      users: [
        {uid: 'user-1', lastPing: 500},
        {uid: 'user-2', lastPing: 600},
      ],
    };
    const event: RoomEvent<RoomEventType.USER_PING> = {
      type: RoomEventType.USER_PING,
      params: {uid: 'user-1'},
      timestamp: 2000,
      uid: 'user-1',
    };
    const result = roomReducer(state, event);
    expect(result.users).toHaveLength(2);
    expect(result.users.find((u) => u.uid === 'user-2')!.lastPing).toBe(600);
  });
});

describe('SET_GAME', () => {
  it('adds a new game entry', () => {
    const event: RoomEvent<RoomEventType.SET_GAME> = {
      type: RoomEventType.SET_GAME,
      params: {gid: 'game-1'},
      timestamp: 1000,
      uid: 'user-1',
    };
    const result = roomReducer(initialRoomState, event);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].gid).toBe('game-1');
  });

  it('deduplicates by gid (replaces existing)', () => {
    const state = {
      ...initialRoomState,
      games: [{gid: 'game-1'}],
    };
    const event: RoomEvent<RoomEventType.SET_GAME> = {
      type: RoomEventType.SET_GAME,
      params: {gid: 'game-1'},
      timestamp: 2000,
      uid: 'user-1',
    };
    const result = roomReducer(state, event);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].gid).toBe('game-1');
  });

  it('preserves other games when adding one', () => {
    const state = {
      ...initialRoomState,
      games: [{gid: 'game-1'}],
    };
    const event: RoomEvent<RoomEventType.SET_GAME> = {
      type: RoomEventType.SET_GAME,
      params: {gid: 'game-2'},
      timestamp: 2000,
      uid: 'user-1',
    };
    const result = roomReducer(state, event);
    expect(result.games).toHaveLength(2);
  });
});

describe('error handling', () => {
  it('returns unchanged state for unknown event type', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const event = {
      type: 'UNKNOWN_TYPE' as any,
      params: {},
      timestamp: 1000,
      uid: 'user-1',
    };
    const result = roomReducer(initialRoomState, event as any);
    expect(result).toBe(initialRoomState);
    spy.mockRestore();
  });
});
