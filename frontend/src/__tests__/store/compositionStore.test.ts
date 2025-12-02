import {ref, onChildAdded, off, push, set} from 'firebase/database';
import {describe, it, expect, beforeEach, vi} from 'vitest';

import {useCompositionStore} from '../../store/compositionStore';

// Mock Firebase
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onChildAdded: vi.fn(),
  off: vi.fn(),
  push: vi.fn(),
  set: vi.fn(),
}));

// Mock firebase store
vi.mock('../../store/firebase', () => ({
  db: {},
  SERVER_TIME: {'.sv': 'timestamp'},
}));

describe('compositionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCompositionStore.setState({compositions: {}});
  });

  describe('getComposition', () => {
    it('should create a new composition instance if it does not exist', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      const composition = useCompositionStore.getState().getComposition('/composition/123');

      expect(composition).toBeDefined();
      expect(composition.path).toBe('/composition/123');
      expect(composition.createEvent).toBeNull();
      expect(composition.attached).toBe(false);
    });

    it('should return existing composition instance if it exists', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      const comp1 = useCompositionStore.getState().getComposition('/composition/123');
      const comp2 = useCompositionStore.getState().getComposition('/composition/123');

      expect(comp1).toBe(comp2);
    });
  });

  describe('attach', () => {
    it('should subscribe to composition events', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      const mockUnsubscribe = vi.fn();
      vi.mocked(onChildAdded).mockReturnValue(mockUnsubscribe);

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().attach('/composition/123');

      expect(onChildAdded).toHaveBeenCalled();
      const state = useCompositionStore.getState();
      expect(state.compositions['/composition/123'].attached).toBe(true);
    });

    it('should emit createEvent when create event is received', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      let eventCallback: ((snapshot: unknown) => void) | null = null;
      vi.mocked(onChildAdded).mockImplementation((_ref, callback) => {
        eventCallback = callback;
        return vi.fn();
      });

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().attach('/composition/123');

      const createEvent = {
        type: 'create',
        params: {title: 'Test', author: 'Author'},
      };

      const callback = vi.fn();
      useCompositionStore.getState().subscribe('/composition/123', 'createEvent', callback);

      if (eventCallback) {
        eventCallback({val: () => createEvent});
      }

      expect(callback).toHaveBeenCalledWith(createEvent);
    });
  });

  describe('detach', () => {
    it('should unsubscribe from composition events', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      const mockUnsubscribe = vi.fn();
      vi.mocked(onChildAdded).mockReturnValue(mockUnsubscribe);

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().attach('/composition/123');
      useCompositionStore.getState().detach('/composition/123');

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(off).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events and return unsubscribe function', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      useCompositionStore.getState().getComposition('/composition/123');

      const callback = vi.fn();
      const unsubscribe = useCompositionStore.getState().subscribe('/composition/123', 'test', callback);

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple subscribers for the same event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      useCompositionStore.getState().getComposition('/composition/123');

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      useCompositionStore.getState().subscribe('/composition/123', 'test', callback1);
      useCompositionStore.getState().subscribe('/composition/123', 'test', callback2);

      const state = useCompositionStore.getState();
      const composition = state.compositions['/composition/123'];
      const subscribers = composition.subscriptions.get('test');
      expect(subscribers?.size).toBe(2);
    });
  });

  describe('updateCellText', () => {
    it('should push updateCellText event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().updateCellText('/composition/123', 0, 1, 'A');

      expect(push).toHaveBeenCalled();
    });

    it('should not push event if composition does not exist', () => {
      useCompositionStore.getState().updateCellText('/composition/nonexistent', 0, 1, 'A');

      expect(push).not.toHaveBeenCalled();
    });
  });

  describe('updateCellColor', () => {
    it('should push updateCellColor event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().updateCellColor('/composition/123', 0, 1, '#ff0000');

      expect(push).toHaveBeenCalled();
    });
  });

  describe('updateClue', () => {
    it('should push updateClue event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().updateClue('/composition/123', 0, 1, 'across', 'Test clue');

      expect(push).toHaveBeenCalled();
    });
  });

  describe('updateCursor', () => {
    it('should push updateCursor event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().updateCursor('/composition/123', 0, 1, 'user-id', '#ff0000');

      expect(push).toHaveBeenCalled();
    });
  });

  describe('updateTitle', () => {
    it('should push updateTitle event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().updateTitle('/composition/123', 'New Title');

      expect(push).toHaveBeenCalled();
    });
  });

  describe('updateAuthor', () => {
    it('should push updateAuthor event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().updateAuthor('/composition/123', 'New Author');

      expect(push).toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    it('should push chat event', () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      useCompositionStore.getState().chat('/composition/123', 'username', 'user-id', 'Hello');

      expect(push).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize composition with default values', async () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      const mockPublishedRef = {path: '/composition/123/published', key: 'published'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        if (path === '/composition/123/published') return mockPublishedRef;
        return {path};
      });
      vi.mocked(set).mockResolvedValue(undefined);
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      useCompositionStore.getState().getComposition('/composition/123');
      await useCompositionStore.getState().initialize('/composition/123');

      expect(set).toHaveBeenCalled();
      expect(push).toHaveBeenCalled();
    });

    it('should initialize composition with provided rawComposition', async () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      const mockPublishedRef = {path: '/composition/123/published', key: 'published'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        if (path === '/composition/123/published') return mockPublishedRef;
        return {path};
      });
      vi.mocked(set).mockResolvedValue(undefined);
      vi.mocked(push).mockReturnValue({key: 'event-1'});

      const rawComposition = {
        info: {title: 'Test Title', author: 'Test Author'},
        grid: [[{value: 'A'}]],
        clues: [],
        circles: [],
        chat: {messages: []},
        cursor: {},
      };

      useCompositionStore.getState().getComposition('/composition/123');
      await useCompositionStore.getState().initialize('/composition/123', rawComposition);

      expect(set).toHaveBeenCalled();
      expect(push).toHaveBeenCalled();
    });

    it('should throw error if info is invalid', async () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      useCompositionStore.getState().getComposition('/composition/123');

      await expect(
        useCompositionStore.getState().initialize('/composition/123', {info: null as any})
      ).rejects.toThrow('Invalid composition: info is required');
    });

    it('should throw error if grid is invalid', async () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      useCompositionStore.getState().getComposition('/composition/123');

      await expect(
        useCompositionStore.getState().initialize('/composition/123', {
          info: {title: 'Test', author: 'Author'},
          grid: null as any,
        })
      ).rejects.toThrow('Invalid composition: grid must be a non-empty array');

      await expect(
        useCompositionStore.getState().initialize('/composition/123', {
          info: {title: 'Test', author: 'Author'},
          grid: [],
        })
      ).rejects.toThrow('Invalid composition: grid must be a non-empty array');
    });

    it('should throw error if clues is invalid', async () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        return {path};
      });

      useCompositionStore.getState().getComposition('/composition/123');

      await expect(
        useCompositionStore.getState().initialize('/composition/123', {
          info: {title: 'Test', author: 'Author'},
          grid: [[{value: ''}]],
          clues: null as any,
        })
      ).rejects.toThrow('Invalid composition: clues must be an array');
    });

    it('should use default values for optional fields', async () => {
      const mockRef = {path: '/composition/123', key: '123'};
      const mockEventsRef = {path: '/composition/123/events', key: 'events'};
      const mockPublishedRef = {path: '/composition/123/published', key: 'published'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/composition/123') return mockRef;
        if (path === '/composition/123/events') return mockEventsRef;
        if (path === '/composition/123/published') return mockPublishedRef;
        return {path};
      });
      vi.mocked(set).mockResolvedValue(undefined);
      vi.mocked(push).mockImplementation((_ref, data) => {
        // Verify default values are used
        const event = data as {type: string; params: {composition: any}};
        if (event.type === 'create') {
          expect(event.params.composition.info.title).toBe('Untitled');
          expect(event.params.composition.info.author).toBe('Anonymous');
          expect(event.params.composition.grid.length).toBe(7);
          expect(event.params.composition.clues).toEqual([]);
        }
        return {key: 'event-1'};
      });

      useCompositionStore.getState().getComposition('/composition/123');
      await useCompositionStore.getState().initialize('/composition/123', {});

      expect(push).toHaveBeenCalled();
    });
  });
});
