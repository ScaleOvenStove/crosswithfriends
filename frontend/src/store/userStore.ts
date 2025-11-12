import {create} from 'zustand';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  FacebookAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import {ref, get, set, runTransaction} from 'firebase/database';
import {db, SERVER_TIME, getTime} from './firebase';
import app from './firebase';
import getLocalId from '../localAuth';
import {rand_color} from '@crosswithfriends/shared/lib/jsUtils';
import type {UserHistory, UserCompositions} from '../types/user';

const disableFbLogin = true;

interface UserState {
  auth: ReturnType<typeof getAuth>;
  attached: boolean;
  color: string;
  fb: FirebaseUser | null;
  id: string | null;
  attach: () => void;
  logIn: () => void;
  listUserHistory: () => Promise<UserHistory | null>;
  listCompositions: () => Promise<UserCompositions | null>;
  joinComposition: (
    cid: string,
    params: {title: string; author: string; published?: boolean}
  ) => Promise<void>;
  joinGame: (gid: string, params?: {pid?: number; solved?: boolean; v2?: boolean}) => Promise<void>;
  markSolved: (gid: string) => void;
  recordUsername: (username: string) => void;
}

export const useUserStore = create<UserState>((setState, getState) => {
  const auth = getAuth(app);
  let unsubscribeAuth: (() => void) | null = null;

  return {
    auth,
    attached: false,
    color: rand_color(),
    fb: null,
    id: null,

    attach: () => {
      if (unsubscribeAuth) return; // Already attached
      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        setState({attached: true, fb: user});
        // Update id when auth state changes
        const state = getState();
        let id: string | null = null;
        if (disableFbLogin) {
          id = getLocalId();
        } else if (state.attached) {
          if (state.fb) {
            id = state.fb.uid;
          } else {
            id = getLocalId();
          }
        }
        setState({id});
      });
    },

    logIn: () => {
      const provider = new FacebookAuthProvider();
      signInWithPopup(auth, provider);
    },

    listUserHistory: async () => {
      const state = getState();
      if (!state.id) return null;
      const snapshot = await get(ref(db, `user/${state.id}/history`));
      return snapshot.val() as UserHistory | null;
    },

    listCompositions: async () => {
      const state = getState();
      if (!state.id) return null;
      const snapshot = await get(ref(db, `user/${state.id}/compositions`));
      return snapshot.val() as UserCompositions | null;
    },

    joinComposition: async (cid: string, {title, author, published = false}) => {
      const state = getState();
      if (!state.id) return;
      await set(ref(db, `user/${state.id}/compositions/${cid}`), {
        title,
        author,
        published,
        updateTime: SERVER_TIME,
      });
    },

    joinGame: async (gid: string, {pid = -1, solved = false, v2 = false} = {}) => {
      const state = getState();
      if (!state.id) return;
      const time = getTime();
      await set(ref(db, `user/${state.id}/history/${gid}`), {
        pid,
        solved,
        time,
        v2,
      });
    },

    markSolved: (gid: string) => {
      const state = getState();
      if (!state.id) return;
      runTransaction(ref(db, `user/${state.id}/history/${gid}`), (item: unknown) => {
        if (!item) {
          return null;
        }
        const historyItem = item as {solved?: boolean; [key: string]: unknown};
        return {
          ...historyItem,
          solved: true,
        };
      });
    },

    recordUsername: (username: string) => {
      const state = getState();
      if (!state.id) return;
      runTransaction(ref(db, `user/${state.id}/names/${username}`), (count = 0) => count + 1);
    },
  };
});

// Helper to get user ID (for backward compatibility during migration)
export const getUser = () => {
  const state = useUserStore.getState();
  if (!state.attached) {
    return null;
  }
  if (disableFbLogin) {
    return getLocalId();
  }
  if (state.fb) {
    return state.fb.uid;
  }
  return getLocalId();
};
