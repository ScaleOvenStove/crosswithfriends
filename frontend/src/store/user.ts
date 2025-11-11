import EventEmitter from './EventEmitter';
import {db, SERVER_TIME, getTime} from './firebase';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  FacebookAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import {ref, get, set, runTransaction} from 'firebase/database';
import app from './firebase';
import getLocalId from '../localAuth';
import {rand_color} from '@crosswithfriends/shared/lib/jsUtils';

const disableFbLogin = true;

export default class User extends EventEmitter {
  auth: ReturnType<typeof getAuth>;
  attached: boolean;
  color: string;
  fb: FirebaseUser | null;

  constructor() {
    super();
    this.auth = getAuth(app);
    this.attached = false;
    this.color = rand_color();
    this.fb = null;
  }

  attach(): void {
    onAuthStateChanged(this.auth, (user) => {
      this.attached = true;
      this.fb = user;
      this.emit('auth');
      console.log('Your id is', this.id);
    });
  }

  logIn(): void {
    const provider = new FacebookAuthProvider();
    signInWithPopup(this.auth, provider);
  }

  get refPath(): string | null {
    const userId = this.id;
    if (!userId) {
      return null;
    }
    return `user/${userId}`;
  }

  offAuth(cbk: () => void): void {
    this.removeListener('auth', cbk);
  }

  onAuth(cbk: () => void): void {
    this.addListener('auth', cbk);
    if (this.attached) {
      cbk();
    }
  }

  // read methods
  get id(): string | null {
    if (disableFbLogin) {
      return getLocalId();
    }
    if (!this.attached) {
      return null;
    }
    if (this.fb) {
      return this.fb.uid;
    }
    return getLocalId();
  }

  listUserHistory(): Promise<any> {
    const userId = this.id;
    if (!userId) {
      return Promise.resolve(null);
    }
    return get(ref(db, `user/${userId}/history`)).then((snapshot) => snapshot.val());
  }

  listCompositions(): Promise<any> {
    const userId = this.id;
    if (!userId) {
      return Promise.resolve(null);
    }
    return get(ref(db, `user/${userId}/compositions`)).then((snapshot) => snapshot.val());
  }

  // write methods
  joinComposition(
    cid: string,
    {title, author, published = false}: {title: string; author: string; published?: boolean}
  ): Promise<void> {
    const userId = this.id;
    if (!userId) {
      return Promise.reject(new Error('User ID is not available'));
    }
    // safe to call this multiple times
    return set(ref(db, `user/${userId}/compositions/${cid}`), {
      title,
      author,
      published,
      updateTime: SERVER_TIME,
    });
  }

  joinGame(
    gid: string,
    {pid = -1, solved = false, v2 = false}: {pid?: number; solved?: boolean; v2?: boolean} = {}
  ): Promise<void> {
    const userId = this.id;
    if (!userId) {
      return Promise.reject(new Error('User ID is not available'));
    }
    const time = getTime();
    // safe to call this multiple times
    return set(ref(db, `user/${userId}/history/${gid}`), {
      pid,
      solved,
      // progress: game.progress,
      time,
      v2,
    });
  }

  markSolved(gid: string): void {
    const userId = this.id;
    if (!userId) {
      return;
    }
    runTransaction(ref(db, `user/${userId}/history/${gid}`), (item) => {
      if (!item) {
        // don't mark un-joined games as solved
        return null;
      }
      return {
        ...item,
        solved: true,
      };
    });
  }

  recordUsername(username: string): void {
    const userId = this.id;
    if (!userId) {
      return;
    }
    runTransaction(ref(db, `user/${userId}/names/${username}`), (count = 0) => count + 1);
  }
}

let globalUser: User | null = null;
export const getUser = (): User => {
  if (!globalUser) {
    globalUser = new User();
    globalUser.attach();
  }
  return globalUser;
};
