import {create} from 'zustand';
import _ from 'lodash';
import {db, SERVER_TIME, type DatabaseReference} from './firebase';
import {ref, onChildAdded, off, push, set} from 'firebase/database';
import type {CompositionEvent, RawComposition, CompositionImportContents, CompositionGrid} from '../types/composition';

export const CURRENT_VERSION = 1.0;

interface CompositionInstance {
  ref: DatabaseReference;
  events: DatabaseReference;
  path: string;
  createEvent: CompositionEvent | null;
  attached: boolean;
  subscriptions: Map<string, Set<(data: unknown) => void>>; // Map-based subscription system
  unsubscribe?: () => void;
}

interface CompositionStore {
  compositions: Record<string, CompositionInstance>;
  getComposition: (path: string) => CompositionInstance;
  attach: (path: string) => void;
  detach: (path: string) => void;
  updateCellText: (path: string, r: number, c: number, value: string) => void;
  updateCellColor: (path: string, r: number, c: number, color: string) => void;
  updateClue: (path: string, r: number, c: number, dir: string, value: string) => void;
  updateCursor: (path: string, r: number, c: number, id: string, color: string) => void;
  updateTitle: (path: string, text: string) => void;
  updateAuthor: (path: string, text: string) => void;
  chat: (path: string, username: string, id: string, text: string) => void;
  import: (path: string, filename: string, contents: CompositionImportContents) => void;
  setGrid: (path: string, grid: CompositionGrid) => void;
  clearPencil: (path: string) => void;
  updateDimensions: (
    path: string,
    width: number,
    height: number,
    options?: {fromX?: string; fromY?: string}
  ) => void;
  initialize: (path: string, rawComposition?: RawComposition) => Promise<void>;
  subscribe: (path: string, event: string, callback: (event: CompositionEvent) => void) => () => void;
}

export const useCompositionStore = create<CompositionStore>((setState, getState) => {
  // Helper function to emit events to subscribers
  const emit = (path: string, event: string, data: unknown): void => {
    const state = getState();
    const composition = state.compositions[path];
    if (!composition) return;
    
    const subscribers = composition.subscriptions.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscription callback for ${event}:`, error);
        }
      });
    }
  };

  return {
    compositions: {},

    getComposition: (path: string) => {
      const state = getState();
      if (!state.compositions[path]) {
        const compositionRef = ref(db, path);
        const eventsRef = ref(db, `${path}/events`);
        setState({
          compositions: {
            ...state.compositions,
            [path]: {
              ref: compositionRef,
              events: eventsRef,
              path,
              createEvent: null,
              attached: false,
              subscriptions: new Map(),
            },
          },
        });
      }
      return getState().compositions[path];
    },

    attach: (path: string) => {
      const state = getState();
      let composition = state.compositions[path];
      if (!composition) {
        composition = state.getComposition(path);
      }

      const unsubscribe = onChildAdded(composition.events, (snapshot) => {
        const event = snapshot.val() as CompositionEvent;
        const currentState = getState();
        const currentComposition = currentState.compositions[path];
        if (!currentComposition) return;

        if (event.type === 'create') {
          setState({
            compositions: {
              ...currentState.compositions,
              [path]: {
                ...currentComposition,
                createEvent: event,
                attached: true,
              },
            },
          });
          emit(path, 'createEvent', event);
        } else {
          emit(path, 'event', event);
        }
      });

      setState({
        compositions: {
          ...state.compositions,
          [path]: {
            ...composition,
            unsubscribe,
            attached: true,
          },
        },
      });
    },

    detach: (path: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      if (composition.unsubscribe) {
        composition.unsubscribe();
      }
      off(composition.events);

      setState({
        compositions: {
          ...state.compositions,
          [path]: {
            ...composition,
            unsubscribe: undefined,
            attached: false,
            subscriptions: new Map(),
          },
        },
      });
    },

    subscribe: (path: string, event: string, callback: (event: CompositionEvent) => void) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return () => {};

      // Get or create subscription set for this event
      if (!composition.subscriptions.has(event)) {
        composition.subscriptions.set(event, new Set());
      }
      const subscribers = composition.subscriptions.get(event)!;
      
      // Add callback to subscribers
      subscribers.add(callback);

      // Return unsubscribe function
      return () => {
        const currentState = getState();
        const currentComposition = currentState.compositions[path];
        if (!currentComposition) return;

        const currentSubscribers = currentComposition.subscriptions.get(event);
        if (currentSubscribers) {
          currentSubscribers.delete(callback);
          // Clean up empty sets
          if (currentSubscribers.size === 0) {
            currentComposition.subscriptions.delete(event);
          }
        }
      };
    },

    updateCellText: (path: string, r: number, c: number, value: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateCellText',
        params: {
          cell: {r, c},
          value,
        },
      });
    },

    updateCellColor: (path: string, r: number, c: number, color: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateCellColor',
        params: {
          cell: {r, c},
          color,
        },
      });
    },

    updateClue: (path: string, r: number, c: number, dir: string, value: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateClue',
        params: {
          cell: {r, c},
          dir,
          value,
        },
      });
    },

    updateCursor: (path: string, r: number, c: number, id: string, color: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateCursor',
        params: {
          timestamp: SERVER_TIME,
          cell: {r, c},
          color,
          id,
        },
      });
    },

    updateTitle: (path: string, text: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateTitle',
        params: {
          text,
        },
      });
    },

    updateAuthor: (path: string, text: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateAuthor',
        params: {
          text,
        },
      });
    },

    chat: (path: string, username: string, id: string, text: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'chat',
        params: {
          text,
          senderId: id,
          sender: username,
        },
      });
    },

    import: (path: string, filename: string, contents: CompositionImportContents) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      const {info, grid, circles, clues} = contents;
      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateComposition',
        params: {
          filename, // unused, for now
          info,
          grid,
          circles,
          clues,
        },
      });
    },

    setGrid: (path: string, grid: CompositionGrid) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateGrid',
        params: {
          grid,
        },
      });
    },

    clearPencil: (path: string) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'clearPencil',
        params: {},
      });
    },

    updateDimensions: (
      path: string,
      width: number,
      height: number,
      {fromX = 'right', fromY = 'down'}: {fromX?: string; fromY?: string} = {}
    ) => {
      const state = getState();
      const composition = state.compositions[path];
      if (!composition) return;

      push(composition.events, {
        timestamp: SERVER_TIME,
        type: 'updateDimensions',
        params: {
          width,
          height,
          fromX,
          fromY,
        },
      });
    },

    initialize: async (path: string, rawComposition: RawComposition = {}) => {
      const {
        info = {
          title: 'Untitled',
          author: 'Anonymous',
        },
        grid = _.range(7).map(() =>
          _.range(7).map(() => ({
            value: '',
          }))
        ),
        clues = [],
        circles = [],
        chat = {messages: []},
        cursor = {},
      } = rawComposition;

      // Validate required fields
      if (!info || typeof info !== 'object') {
        throw new Error('Invalid composition: info is required');
      }
      if (!grid || !Array.isArray(grid) || grid.length === 0) {
        throw new Error('Invalid composition: grid must be a non-empty array');
      }
      if (!clues || !Array.isArray(clues)) {
        throw new Error('Invalid composition: clues must be an array');
      }

      const composition = {
        info,
        grid,
        clues,
        circles,
        chat,
        cursor,
      };
      const version = CURRENT_VERSION;

      const state = getState();
      const compositionInstance = state.compositions[path] || state.getComposition(path);

      // nuke existing events
      await set(compositionInstance.events, {});
      await push(compositionInstance.events, {
        timestamp: SERVER_TIME,
        type: 'create',
        params: {
          version,
          composition,
        },
      });
      await set(ref(db, `${path}/published`), false);
    },
  };
});
