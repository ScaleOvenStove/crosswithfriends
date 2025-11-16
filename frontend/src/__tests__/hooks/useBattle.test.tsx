import {renderHook} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useBattle} from '../../hooks/useBattle';
import {createMockBattleStore} from '../mocks/stores';

const mockUseBattleStore = vi.fn();
const mockUseStoreSubscriptions = vi.fn();

// Mock the battle store
vi.mock('../../store/battleStore', () => ({
  useBattleStore: () => mockUseBattleStore(),
}));

// Mock useStoreSubscriptions
vi.mock('../../hooks/useStoreSubscriptions', () => ({
  useStoreSubscriptions: () => mockUseStoreSubscriptions(),
}));

describe('useBattle', () => {
  let mockStore: ReturnType<typeof createMockBattleStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockBattleStore();
    mockUseBattleStore.mockImplementation((selector?: any) => {
      if (selector) {
        return selector({
          battles: {
            '/battle/test': {
              ready: true,
            },
          },
        });
      }
      return mockStore;
    });
  });

  it('should return battle from store', () => {
    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    expect(result.current.battle).toBeDefined();
  });

  it('should call attach when attach is called', () => {
    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.attach();

    expect(mockStore.attach).toHaveBeenCalledWith('/battle/test');
  });

  it('should not call attach if path is empty', () => {
    const {result} = renderHook(() => useBattle({path: ''}));

    result.current.attach();

    expect(mockStore.attach).not.toHaveBeenCalled();
  });

  it('should call detach when detach is called', () => {
    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.detach();

    expect(mockStore.detach).toHaveBeenCalledWith('/battle/test');
  });

  it('should call start when start is called', () => {
    mockStore.start = vi.fn();

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.start();

    expect(mockStore.start).toHaveBeenCalledWith('/battle/test');
  });

  it('should call setSolved with correct parameters', () => {
    mockStore.setSolved = vi.fn();

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.setSolved(1);

    expect(mockStore.setSolved).toHaveBeenCalledWith('/battle/test', 1);
  });

  it('should call addPlayer with correct parameters', () => {
    mockStore.addPlayer = vi.fn();

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.addPlayer('player-name', 1);

    expect(mockStore.addPlayer).toHaveBeenCalledWith('/battle/test', 'player-name', 1);
  });

  it('should call removePlayer with correct parameters', () => {
    mockStore.removePlayer = vi.fn();

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.removePlayer('player-name', 1);

    expect(mockStore.removePlayer).toHaveBeenCalledWith('/battle/test', 'player-name', 1);
  });

  it('should call usePowerup with correct parameters', () => {
    mockStore.usePowerup = vi.fn();

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.usePowerup('freeze', 1);

    expect(mockStore.usePowerup).toHaveBeenCalledWith('/battle/test', 'freeze', 1);
  });

  it('should call initialize with correct parameters', () => {
    mockStore.initialize = vi.fn();

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    result.current.initialize(123, 456, 2);

    expect(mockStore.initialize).toHaveBeenCalledWith('/battle/test', 123, 456, 2);
  });

  it('should return subscribe function', () => {
    const unsubscribe = vi.fn();
    mockStore.subscribe = vi.fn().mockReturnValue(unsubscribe);

    const {result} = renderHook(() => useBattle({path: '/battle/test'}));

    const callback = vi.fn();
    const unsub = result.current.subscribe('test-event', callback);

    expect(mockStore.subscribe).toHaveBeenCalledWith('/battle/test', 'test-event', callback);
    expect(unsub).toBe(unsubscribe);
  });

  it('should return no-op unsubscribe if path is empty', () => {
    const {result} = renderHook(() => useBattle({path: ''}));

    const callback = vi.fn();
    const unsub = result.current.subscribe('test-event', callback);

    expect(mockStore.subscribe).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub(); // Should not throw
  });
});
