/**
 * Offline Store
 * Manages offline state and queued actions using IndexedDB
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';

import {logger} from '../utils/logger';
import type {QueuedAction} from '../utils/offlineManager';

interface OfflineStore {
  isOnline: boolean;
  queuedActions: QueuedAction[];
  lastSyncTime: number | null;
  syncInProgress: boolean;
  conflicts: Array<{
    id: string;
    localAction: QueuedAction;
    serverState: unknown;
    timestamp: number;
  }>;
  setIsOnline: (isOnline: boolean) => void;
  addQueuedAction: (action: QueuedAction) => void;
  removeQueuedAction: (id: string) => void;
  clearQueuedActions: () => void;
  setLastSyncTime: (time: number | null) => void;
  setSyncInProgress: (inProgress: boolean) => void;
  addConflict: (conflict: OfflineStore['conflicts'][0]) => void;
  removeConflict: (id: string) => void;
  clearConflicts: () => void;
}

// Simple IndexedDB storage implementation
const getIndexedDBStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };
  }

  const DB_NAME = 'crosswithfriends_offline';
  const STORE_NAME = 'offline_state';
  const DB_VERSION = 1;

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  };

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(name);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const result = request.result;
            resolve(result ? JSON.stringify(result) : null);
          };
        });
      } catch (error) {
        logger.errorWithException('Error reading from IndexedDB', error);
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(JSON.parse(value), name);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      } catch (error) {
        logger.errorWithException('Error writing to IndexedDB', error);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(name);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      } catch (error) {
        logger.errorWithException('Error removing from IndexedDB', error);
      }
    },
  };
};

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== 'undefined' && navigator.onLine,
      queuedActions: [],
      lastSyncTime: null,
      syncInProgress: false,
      conflicts: [],

      setIsOnline: (isOnline: boolean) => set({isOnline}),

      addQueuedAction: (action: QueuedAction) =>
        set((state) => ({
          queuedActions: [...state.queuedActions, action],
        })),

      removeQueuedAction: (id: string) =>
        set((state) => ({
          queuedActions: state.queuedActions.filter((action) => action.id !== id),
        })),

      clearQueuedActions: () => set({queuedActions: []}),

      setLastSyncTime: (time: number | null) => set({lastSyncTime: time}),

      setSyncInProgress: (inProgress: boolean) => set({syncInProgress: inProgress}),

      addConflict: (conflict: OfflineStore['conflicts'][0]) =>
        set((state) => ({
          conflicts: [...state.conflicts, conflict],
        })),

      removeConflict: (id: string) =>
        set((state) => ({
          conflicts: state.conflicts.filter((conflict) => conflict.id !== id),
        })),

      clearConflicts: () => set({conflicts: []}),
    }),
    {
      name: 'offline-storage',
      storage: createJSONStorage(() => getIndexedDBStorage()),
      partialize: (state) => ({
        queuedActions: state.queuedActions,
        lastSyncTime: state.lastSyncTime,
        conflicts: state.conflicts,
      }),
    }
  )
);
