/**
 * Firebase Realtime Database Module
 * Implements real-time data synchronization for game state
 * Per codeguard-0-data-storage: Enforce encrypted connections (handled by Firebase)
 */

import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  off,
  push,
  serverTimestamp,
} from 'firebase/database';
import type { DatabaseReference, Unsubscribe } from 'firebase/database';
import { database, isFirebaseConfigured } from './config';

// Check if database is available
const ensureDatabase = () => {
  if (!isFirebaseConfigured || !database) {
    throw new Error(
      'Firebase Database is not configured. Set VITE_FIREBASE_* environment variables.'
    );
  }
  return database;
};

/**
 * Write data to a path
 */
export const writeData = async (path: string, data: unknown): Promise<void> => {
  const db = ensureDatabase();
  const dbRef = ref(db, path);
  await set(dbRef, data);
};

/**
 * Read data from a path once
 */
export const readData = async <T = unknown>(path: string): Promise<T | null> => {
  const db = ensureDatabase();
  const dbRef = ref(db, path);
  const snapshot = await get(dbRef);

  if (snapshot.exists()) {
    return snapshot.val() as T;
  }

  return null;
};

/**
 * Update specific fields at a path
 */
export const updateData = async (path: string, updates: Record<string, unknown>): Promise<void> => {
  const db = ensureDatabase();
  const dbRef = ref(db, path);
  await update(dbRef, updates);
};

/**
 * Delete data at a path
 */
export const deleteData = async (path: string): Promise<void> => {
  const db = ensureDatabase();
  const dbRef = ref(db, path);
  await remove(dbRef);
};

/**
 * Push new data to a list (generates unique ID)
 */
export const pushData = async (path: string, data: unknown): Promise<string> => {
  const db = ensureDatabase();
  const dbRef = ref(db, path);
  const newRef = push(dbRef);
  await set(newRef, data);
  return newRef.key!;
};

/**
 * Listen for real-time changes at a path
 * Returns unsubscribe function
 */
export const subscribeToData = <T = unknown>(
  path: string,
  callback: (data: T | null) => void
): Unsubscribe => {
  const db = ensureDatabase();
  const dbRef = ref(db, path);

  const listener = onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as T);
    } else {
      callback(null);
    }
  });

  // Return unsubscribe function
  return () => off(dbRef, 'value', listener);
};

/**
 * Set user presence (online/offline status)
 */
export const setPresence = async (
  userId: string,
  status: 'online' | 'offline' | 'away'
): Promise<void> => {
  const db = ensureDatabase();
  const presenceRef = ref(db, `presence/${userId}`);

  await set(presenceRef, {
    status,
    lastSeen: serverTimestamp(),
  });
};

/**
 * Subscribe to user presence
 */
export const subscribeToPresence = (
  userId: string,
  callback: (status: 'online' | 'offline' | 'away', lastSeen: number) => void
): Unsubscribe => {
  return subscribeToData<{ status: 'online' | 'offline' | 'away'; lastSeen: number }>(
    `presence/${userId}`,
    (data) => {
      if (data) {
        callback(data.status, data.lastSeen);
      }
    }
  );
};

/**
 * Sync game state to database
 */
export const syncGameState = async (gameId: string, state: unknown): Promise<void> => {
  await writeData(`games/${gameId}/state`, state);
};

/**
 * Subscribe to game state changes
 */
export const subscribeToGameState = <T = unknown>(
  gameId: string,
  callback: (state: T | null) => void
): Unsubscribe => {
  return subscribeToData<T>(`games/${gameId}/state`, callback);
};

/**
 * Add chat message to room
 */
export const addChatMessage = async (
  roomId: string,
  userId: string,
  userName: string,
  message: string
): Promise<string> => {
  return pushData(`rooms/${roomId}/messages`, {
    userId,
    userName,
    message,
    timestamp: serverTimestamp(),
  });
};

/**
 * Subscribe to room chat messages
 */
export const subscribeToRoomMessages = (
  roomId: string,
  callback: (
    messages: Array<{ userId: string; userName: string; message: string; timestamp: number }>
  ) => void
): Unsubscribe => {
  return subscribeToData(`rooms/${roomId}/messages`, (data) => {
    if (data) {
      // Convert object to array
      const messages = Object.values(data);
      callback(
        messages as Array<{ userId: string; userName: string; message: string; timestamp: number }>
      );
    } else {
      callback([]);
    }
  });
};
