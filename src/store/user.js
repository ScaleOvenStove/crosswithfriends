import EventEmitter from 'events';
import firebase, {db} from './firebase';
import getLocalId from '../localAuth';
import {pickDistinctColor} from '../lib/colorAssignment';

const disableFbLogin = true;

export default class User extends EventEmitter {
  constructor() {
    super();
    this.auth = firebase.auth();
    this.attached = false;
    this.color = pickDistinctColor([]);
  }

  attach() {
    this.auth.onAuthStateChanged((user) => {
      this.attached = true;
      this.fb = user;
      this.emit('auth');
      console.log('Your id is', this.id);
    });
  }

  logIn() {
    const provider = new firebase.auth.FacebookAuthProvider();
    this.auth.signInWithPopup(provider);
  }

  get ref() {
    return db.ref(`user/${this.id}`);
  }

  offAuth(cbk) {
    this.removeListener('auth', cbk);
  }

  onAuth(cbk) {
    this.addListener('auth', cbk);
    if (this.attached) {
      cbk();
    }
  }

  // read methods
  get id() {
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

  listUserHistory() {
    return this.ref
      .child('history')
      .once('value')
      .then((snapshot) => snapshot.val());
  }

  joinGame(gid, {pid = -1, solved = false, v2 = false}) {
    const time = Date.now();
    // safe to call this multiple times
    return this.ref.child('history').child(gid).set({
      pid,
      solved,
      // progress: game.progress,
      time,
      v2,
    });
  }

  removeGame(gid) {
    return this.ref.child('history').child(gid).remove();
  }

  markSolved(gid) {
    this.ref
      .child('history')
      .child(gid)
      .transaction((item) => {
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
}

let globalUser;
export const getUser = () => {
  if (!globalUser) {
    globalUser = new User();
    globalUser.attach();
  }
  return globalUser;
};
