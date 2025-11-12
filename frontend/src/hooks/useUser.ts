/**
 * Custom hook for user management
 * Provides user state, authentication, and user actions
 */

import {useEffect, useRef} from 'react';
import {useUserStore} from '../store/userStore';

interface UseUserOptions {
  onAuth?: () => void; // Callback when auth state changes (for backward compatibility)
}

interface UseUserReturn {
  id: string | null;
  color: string;
  fb: ReturnType<typeof useUserStore.getState>['fb'];
  attached: boolean;
  attach: () => void;
  logIn: () => void;
  listUserHistory: () => Promise<unknown>;
  listCompositions: () => Promise<unknown>;
  joinComposition: (cid: string, params: {title: string; author: string; published?: boolean}) => Promise<void>;
  joinGame: (gid: string, params?: {pid?: number; solved?: boolean; v2?: boolean}) => Promise<void>;
  markSolved: (gid: string) => void;
  recordUsername: (username: string) => void;
  onAuth: (callback: () => void) => () => void; // Subscribe to auth events (EventEmitter compatibility)
}

export function useUser(options: UseUserOptions = {}): UseUserReturn {
  const {onAuth: onAuthCallback} = options;
  const userStore = useUserStore();
  const {id, color, fb, attached, attach, logIn, listUserHistory, listCompositions, joinComposition, joinGame, markSolved, recordUsername} = userStore;
  const authCallbacksRef = useRef<Set<() => void>>(new Set());

  // Auto-attach on mount
  useEffect(() => {
    if (!attached) {
      attach();
    }
  }, [attached, attach]);

  // Call onAuth callback when attached changes
  useEffect(() => {
    if (attached && onAuthCallback) {
      onAuthCallback();
    }
  }, [attached, onAuthCallback]);

  // Call all registered auth callbacks when attached changes
  useEffect(() => {
    if (attached) {
      authCallbacksRef.current.forEach((callback) => callback());
    }
  }, [attached]);

  // onAuth method for EventEmitter compatibility
  // Note: This is kept as a function (not memoized) since it's used for EventEmitter compatibility
  const onAuth = (callback: () => void) => {
    authCallbacksRef.current.add(callback);
    // If already attached, call immediately
    if (attached) {
      callback();
    }
    // Return unsubscribe function
    return () => {
      authCallbacksRef.current.delete(callback);
    };
  };

  return {
    id,
    color,
    fb,
    attached,
    attach,
    logIn,
    listUserHistory,
    listCompositions,
    joinComposition,
    joinGame,
    markSolved,
    recordUsername,
    onAuth,
  };
}

