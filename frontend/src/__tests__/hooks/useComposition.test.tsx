import {renderHook} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useComposition} from '../../hooks/useComposition';
import {createMockCompositionStore} from '../mocks/stores';

const mockUseCompositionStore = vi.fn();
const mockUseStoreSubscriptions = vi.fn();

// Mock the composition store
vi.mock('../../store/compositionStore', () => ({
  useCompositionStore: (selector?: (state: unknown) => unknown) => mockUseCompositionStore(selector),
}));

// Mock useStoreSubscriptions
vi.mock('../../hooks/useStoreSubscriptions', () => ({
  useStoreSubscriptions: () => mockUseStoreSubscriptions(),
}));

describe('useComposition', () => {
  let mockStore: ReturnType<typeof createMockCompositionStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockCompositionStore();
    const mockState = {
      compositions: {
        '/composition/test': {
          attached: true,
          createEvent: null,
        },
      },
    };
    mockUseCompositionStore.mockImplementation((selector?: (state: unknown) => unknown) => {
      if (selector) {
        return selector(mockState);
      }
      return mockStore;
    });
  });

  it('should return composition and methods', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    expect(result.current.composition).toBeDefined();
    expect(result.current.attach).toBeDefined();
    expect(result.current.detach).toBeDefined();
    expect(result.current.updateCellText).toBeDefined();
    expect(result.current.ready).toBeDefined();
  });

  it('should call attach when attach is called', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.attach();

    expect(mockStore.attach).toHaveBeenCalledWith('/composition/test');
  });

  it('should call detach when detach is called', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.detach();

    expect(mockStore.detach).toHaveBeenCalledWith('/composition/test');
  });

  it('should call updateCellText with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.updateCellText(0, 1, 'A');

    expect(mockStore.updateCellText).toHaveBeenCalledWith('/composition/test', 0, 1, 'A');
  });

  it('should call updateCellColor with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.updateCellColor(0, 1, '#ff0000');

    expect(mockStore.updateCellColor).toHaveBeenCalledWith('/composition/test', 0, 1, '#ff0000');
  });

  it('should call updateClue with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.updateClue(0, 1, 'across', 'Test clue');

    expect(mockStore.updateClue).toHaveBeenCalledWith('/composition/test', 0, 1, 'across', 'Test clue');
  });

  it('should call updateCursor with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.updateCursor(0, 1, 'user-id', '#ff0000');

    expect(mockStore.updateCursor).toHaveBeenCalledWith('/composition/test', 0, 1, 'user-id', '#ff0000');
  });

  it('should call updateTitle with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.updateTitle('New Title');

    expect(mockStore.updateTitle).toHaveBeenCalledWith('/composition/test', 'New Title');
  });

  it('should call updateAuthor with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.updateAuthor('New Author');

    expect(mockStore.updateAuthor).toHaveBeenCalledWith('/composition/test', 'New Author');
  });

  it('should call chat with correct parameters', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    result.current.chat('username', 'user-id', 'Hello');

    expect(mockStore.chat).toHaveBeenCalledWith('/composition/test', 'username', 'user-id', 'Hello');
  });

  it('should return ready state based on composition attached status', () => {
    const mockComposition = {
      attached: true,
      createEvent: null,
      subscriptions: new Map(),
    };
    const mockState = {
      compositions: {
        '/composition/test': mockComposition,
      },
    };

    // Set up mock before rendering hook - ensure it handles both calls
    mockUseCompositionStore.mockImplementation((selector?: (state: unknown) => unknown) => {
      // When called with selector (to get composition)
      if (selector) {
        const result = selector(mockState);
        return result;
      }
      // When called without selector (to get store methods)
      return mockStore;
    });

    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    // The composition should be found and ready should be true
    expect(result.current.composition).toEqual(mockComposition);
    expect(result.current.ready).toBe(true);
  });

  it('should return false ready state when composition is not attached', () => {
    const mockState = {
      compositions: {
        '/composition/test': {
          attached: false,
        },
      },
    };
    mockUseCompositionStore.mockImplementation((selector?: (state: unknown) => unknown) => {
      if (selector) {
        return selector(mockState);
      }
      return mockStore;
    });

    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    expect(result.current.ready).toBe(false);
  });

  it('should call subscribe and return unsubscribe function', () => {
    const {result} = renderHook(() => useComposition({path: '/composition/test'}));

    const callback = vi.fn();
    const unsubscribe = result.current.subscribe('test', callback);

    expect(mockStore.subscribe).toHaveBeenCalledWith('/composition/test', 'test', callback);
    expect(unsubscribe).toBeDefined();
    expect(typeof unsubscribe).toBe('function');
  });
});
