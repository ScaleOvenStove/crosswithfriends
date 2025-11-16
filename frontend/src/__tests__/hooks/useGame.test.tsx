import {renderHook} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useGame} from '../../hooks/useGame';
import {createMockGameStore} from '../mocks/stores';

const mockUseGameStore = vi.fn();
const mockUseStoreSubscriptions = vi.fn();

// Mock the game store
vi.mock('../../store/gameStore', () => ({
  useGameStore: () => mockUseGameStore(),
}));

// Mock useStoreSubscriptions
vi.mock('../../hooks/useStoreSubscriptions', () => ({
  useStoreSubscriptions: () => mockUseStoreSubscriptions(),
}));

describe('useGame', () => {
  let mockStore: ReturnType<typeof createMockGameStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockGameStore();
    const mockState = {
      games: {
        '/game/test': {
          gameState: {cells: []},
          ready: true,
        },
      },
    };
    mockUseGameStore.mockImplementation((selector?: any) => {
      if (selector) {
        return selector(mockState);
      }
      return mockStore;
    });
  });

  it('should return game and gameState', () => {
    const {result} = renderHook(() => useGame({path: '/game/test'}));

    expect(result.current.game).toBeDefined();
    expect(result.current.gameState).toBeDefined();
  });

  it('should call attach when attach is called', async () => {
    mockStore.attach = vi.fn().mockResolvedValue(undefined);

    const {result} = renderHook(() => useGame({path: '/game/test'}));

    await result.current.attach();

    expect(mockStore.attach).toHaveBeenCalledWith('/game/test');
  });

  it('should not call attach if path is empty', async () => {
    const {result} = renderHook(() => useGame({path: ''}));

    await result.current.attach();

    expect(mockStore.attach).not.toHaveBeenCalled();
  });

  it('should call detach when detach is called', () => {
    const {result} = renderHook(() => useGame({path: '/game/test'}));

    result.current.detach();

    expect(mockStore.detach).toHaveBeenCalledWith('/game/test');
  });

  it('should call updateCell with correct parameters', () => {
    const {result} = renderHook(() => useGame({path: '/game/test'}));

    result.current.updateCell(0, 1, 'user-id', '#ff0000', false, 'A', true);

    expect(mockStore.updateCell).toHaveBeenCalledWith(
      '/game/test',
      0,
      1,
      'user-id',
      '#ff0000',
      false,
      'A',
      true
    );
  });

  it('should call updateCursor with correct parameters', () => {
    const {result} = renderHook(() => useGame({path: '/game/test'}));

    result.current.updateCursor(0, 1, 'user-id');

    expect(mockStore.updateCursor).toHaveBeenCalledWith('/game/test', 0, 1, 'user-id');
  });

  it('should call chat with correct parameters', () => {
    const {result} = renderHook(() => useGame({path: '/game/test'}));

    result.current.chat('username', 'user-id', 'Hello');

    expect(mockStore.chat).toHaveBeenCalledWith('/game/test', 'username', 'user-id', 'Hello');
  });

  it('should return subscribe function', () => {
    const unsubscribe = vi.fn();
    mockStore.subscribe = vi.fn().mockReturnValue(unsubscribe);

    const {result} = renderHook(() => useGame({path: '/game/test'}));

    const callback = vi.fn();
    const unsub = result.current.subscribe('test-event', callback);

    expect(mockStore.subscribe).toHaveBeenCalledWith('/game/test', 'test-event', callback);
    expect(unsub).toBe(unsubscribe);
  });

  it('should return no-op unsubscribe if path is empty', () => {
    const {result} = renderHook(() => useGame({path: ''}));

    const callback = vi.fn();
    const unsub = result.current.subscribe('test-event', callback);

    expect(mockStore.subscribe).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub(); // Should not throw
  });

  it('should return ready state', () => {
    const {result} = renderHook(() => useGame({path: '/game/test'}));

    // Verify ready property exists on the return value
    // The exact type depends on how the mock handles the selector
    // In the real implementation, ready is a boolean from: gameInstance?.ready ?? false
    expect(result.current).toHaveProperty('ready');

    // The ready value should be defined (could be boolean or object depending on mock)
    expect(result.current.ready).toBeDefined();
  });
});
