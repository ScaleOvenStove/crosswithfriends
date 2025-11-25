import {renderHook} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useStoreSubscriptions} from '../../hooks/useStoreSubscriptions';

describe('useStoreSubscriptions', () => {
  let mockStore: {
    subscribe: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {
      subscribe: vi.fn(() => () => {}), // Returns unsubscribe function
    };
  });

  it('should subscribe to events with defined callbacks', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    renderHook(() =>
      useStoreSubscriptions(mockStore, '/test/path', {
        event1: callback1,
        event2: callback2,
      })
    );

    expect(mockStore.subscribe).toHaveBeenCalledTimes(2);
    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path', 'event1', callback1);
    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path', 'event2', callback2);
  });

  it('should ignore undefined callbacks', () => {
    const callback1 = vi.fn();

    renderHook(() =>
      useStoreSubscriptions(mockStore, '/test/path', {
        event1: callback1,
        event2: undefined,
        event3: undefined,
      })
    );

    expect(mockStore.subscribe).toHaveBeenCalledTimes(1);
    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path', 'event1', callback1);
  });

  it('should unsubscribe when component unmounts', () => {
    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    mockStore.subscribe = vi.fn((_path, _event, _callback) => {
      if (mockStore.subscribe.mock.calls.length === 1) return unsubscribe1;
      return unsubscribe2;
    });

    const {unmount} = renderHook(() =>
      useStoreSubscriptions(mockStore, '/test/path', {
        event1: vi.fn(),
        event2: vi.fn(),
      })
    );

    unmount();

    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });

  it('should resubscribe when path changes', () => {
    const callback = vi.fn();

    const {rerender} = renderHook(({path}) => useStoreSubscriptions(mockStore, path, {event1: callback}), {
      initialProps: {path: '/test/path1'},
    });

    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path1', 'event1', callback);

    rerender({path: '/test/path2'});

    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path2', 'event1', callback);
  });

  it('should resubscribe when callbacks change', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const {rerender} = renderHook(
      ({callback}) => useStoreSubscriptions(mockStore, '/test/path', {event1: callback}),
      {
        initialProps: {callback: callback1},
      }
    );

    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path', 'event1', callback1);

    rerender({callback: callback2});

    expect(mockStore.subscribe).toHaveBeenCalledWith('/test/path', 'event1', callback2);
  });

  it('should handle empty subscriptions object', () => {
    renderHook(() => useStoreSubscriptions(mockStore, '/test/path', {}));

    expect(mockStore.subscribe).not.toHaveBeenCalled();
  });
});
