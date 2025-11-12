/**
 * Custom hook for composition management
 * Provides composition state, actions, and event subscriptions
 */

import {useEffect} from 'react';
import {useCompositionStore} from '../store/compositionStore';
import type {CompositionEvent} from '../types/composition';
import {useStoreSubscriptions} from './useStoreSubscriptions';

interface UseCompositionOptions {
  path: string;
  onCreateEvent?: (event: CompositionEvent) => void;
  onEvent?: (event: CompositionEvent) => void;
}

interface UseCompositionReturn {
  composition: ReturnType<typeof useCompositionStore.getState>['compositions'][string] | undefined;
  attach: () => void;
  detach: () => void;
  updateCellText: (r: number, c: number, value: string) => void;
  updateCellColor: (r: number, c: number, color: string) => void;
  updateClue: (r: number, c: number, dir: string, value: string) => void;
  updateCursor: (r: number, c: number, id: string, color: string) => void;
  updateTitle: (text: string) => void;
  updateAuthor: (text: string) => void;
  chat: (username: string, id: string, text: string) => void;
  import: (filename: string, contents: unknown) => void;
  setGrid: (grid: unknown) => void;
  clearPencil: () => void;
  updateDimensions: (width: number, height: number, options?: {fromX?: string; fromY?: string}) => void;
  initialize: (rawComposition?: unknown) => Promise<void>;
  subscribe: (event: string, callback: (event: CompositionEvent) => void) => () => void;
  ready: boolean;
}

export function useComposition(options: UseCompositionOptions): UseCompositionReturn {
  const {path, onCreateEvent, onEvent} = options;
  const compositionStore = useCompositionStore();
  // Use selector to get reactive updates when composition state changes
  const composition = useCompositionStore((state) => state.compositions[path]);
  
  // Ensure composition instance exists (lazy initialization)
  useEffect(() => {
    if (!composition) {
      compositionStore.getComposition(path);
    }
  }, [composition, path, compositionStore]);

  // Set up event listeners using generic subscription hook
  useStoreSubscriptions(compositionStore, path, {
    createEvent: onCreateEvent,
    event: onEvent,
  });

  // Return methods directly without memoization - they're not passed as dependencies
  return {
    composition,
    attach: () => compositionStore.attach(path),
    detach: () => compositionStore.detach(path),
    updateCellText: (r: number, c: number, value: string) => compositionStore.updateCellText(path, r, c, value),
    updateCellColor: (r: number, c: number, color: string) => compositionStore.updateCellColor(path, r, c, color),
    updateClue: (r: number, c: number, dir: string, value: string) => compositionStore.updateClue(path, r, c, dir, value),
    updateCursor: (r: number, c: number, id: string, color: string) => compositionStore.updateCursor(path, r, c, id, color),
    updateTitle: (text: string) => compositionStore.updateTitle(path, text),
    updateAuthor: (text: string) => compositionStore.updateAuthor(path, text),
    chat: (username: string, id: string, text: string) => compositionStore.chat(path, username, id, text),
    import: (filename: string, contents: unknown) => compositionStore.import(path, filename, contents),
    setGrid: (grid: unknown) => compositionStore.setGrid(path, grid),
    clearPencil: () => compositionStore.clearPencil(path),
    updateDimensions: (width: number, height: number, options?: {fromX?: string; fromY?: string}) =>
      compositionStore.updateDimensions(path, width, height, options),
    initialize: async (rawComposition?: unknown) => await compositionStore.initialize(path, rawComposition),
    subscribe: (event: string, callback: (event: CompositionEvent) => void) =>
      compositionStore.subscribe(path, event, callback),
    ready: composition?.attached ?? false,
  };
}

