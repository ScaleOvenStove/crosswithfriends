import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useUser} from '../../hooks/useUser';
import {createMockUserStore} from '../mocks/stores';

const mockUseUserStore = vi.fn();

// Mock the user store
vi.mock('../../store/userStore', () => ({
  useUserStore: () => mockUseUserStore(),
}));

describe('useUser', () => {
  let mockStore: ReturnType<typeof createMockUserStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockUserStore();
    mockUseUserStore.mockReturnValue(mockStore);
  });

  it('should return user state from store', () => {
    mockStore.id = 'test-user-id';
    mockStore.color = '#ff0000';
    mockStore.attached = true;

    const {result} = renderHook(() => useUser());

    expect(result.current.id).toBe('test-user-id');
    expect(result.current.color).toBe('#ff0000');
    expect(result.current.attached).toBe(true);
  });

  it('should call attach on mount if not attached', () => {
    mockStore.attached = false;

    renderHook(() => useUser());

    expect(mockStore.attach).toHaveBeenCalled();
  });

  it('should not call attach if already attached', () => {
    mockStore.attached = true;

    renderHook(() => useUser());

    expect(mockStore.attach).not.toHaveBeenCalled();
  });

  it('should call onAuth callback when attached becomes true', async () => {
    mockStore.attached = false;
    const onAuthCallback = vi.fn();

    renderHook(() => useUser({onAuth: onAuthCallback}));

    // Simulate attachment
    mockStore.attached = true;
    // Trigger re-render
    const {rerender} = renderHook(() => useUser({onAuth: onAuthCallback}));
    rerender();

    await waitFor(() => {
      expect(onAuthCallback).toHaveBeenCalled();
    });
  });

  it('should provide onAuth subscription method', () => {
    mockStore.attached = true;

    const {result} = renderHook(() => useUser());

    const callback = vi.fn();
    const unsubscribe = result.current.onAuth(callback);

    expect(callback).toHaveBeenCalled(); // Should call immediately if attached
    expect(typeof unsubscribe).toBe('function');
  });

  it('should call logIn when logIn is called', () => {
    const {result} = renderHook(() => useUser());

    result.current.logIn();

    expect(mockStore.logIn).toHaveBeenCalled();
  });

  it('should call joinGame with correct parameters', async () => {
    mockStore.joinGame = vi.fn().mockResolvedValue(undefined);

    const {result} = renderHook(() => useUser());

    await result.current.joinGame('test-gid', {pid: 123, solved: false});

    expect(mockStore.joinGame).toHaveBeenCalledWith('test-gid', {pid: 123, solved: false});
  });

  it('should call markSolved with correct gid', () => {
    const {result} = renderHook(() => useUser());

    result.current.markSolved('test-gid');

    expect(mockStore.markSolved).toHaveBeenCalledWith('test-gid');
  });

  it('should call recordUsername with correct username', () => {
    const {result} = renderHook(() => useUser());

    result.current.recordUsername('test-username');

    expect(mockStore.recordUsername).toHaveBeenCalledWith('test-username');
  });
});
