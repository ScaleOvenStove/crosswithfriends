/* eslint-disable no-param-reassign */
import * as Sentry from '@sentry/react';
import EventEmitter from 'events';
import _ from 'lodash';
import * as uuid from 'uuid';
import * as colors from '../lib/colors';
import {emitAsync, emitAsyncWithTimeout} from '../sockets/emitAsync';
import {getSocket} from '../sockets/getSocket';
import {db} from './firebase';

// ============ Serialize / Deserialize Helpers ========== //

// Recursively walks obj and converts `null` to `undefined`
const castNullsToUndefined = (obj) => {
  if (_.isNil(obj)) {
    return undefined;
  }
  if (typeof obj === 'object') {
    return Object.assign(
      obj.constructor(),
      _.fromPairs(_.keys(obj).map((key) => [key, castNullsToUndefined(obj[key])]))
    );
  }
  return obj;
};

// a wrapper class that models Game

const CURRENT_VERSION = 1.0;
export default class Game extends EventEmitter {
  constructor(path) {
    super();
    window.game = this;
    this.path = path;
    this.ref = db.ref(path);
    this.eventsRef = this.ref.child('events');
    this.createEvent = null;
    this.syncState = null; // null | 'retrying' | 'failed'
  }

  get gid() {
    // NOTE: path is a string that looks like "/game/39-vosk"
    return this.path.substring(6);
  }

  // Websocket code
  async connectToWebsocket() {
    if (this.socket) return;
    const socket = await getSocket();
    this.socket = socket;
    await emitAsync(socket, 'join_game', this.gid);

    socket.on('disconnect', () => {
      console.log('received disconnect from server');
    });

    // handle future reconnects
    socket.on('connect', async () => {
      console.log('reconnecting...');
      await emitAsync(socket, 'join_game', this.gid);
      console.log('reconnected...');
      // Only clear sync state if not 'failed' — failed events exhausted retries
      // and were never persisted, so reconnecting doesn't fix them
      if (this.syncState !== 'failed') {
        this.syncState = null;
      }
      this.emitReconnect();
    });
  }

  emitEvent(event) {
    if (event.type === 'create') {
      this.emit('createEvent', event);
    } else {
      this.emit('event', event);
    }
  }

  emitWSEvent(event) {
    if (event.type === 'create') {
      this.emit('wsCreateEvent', event);
    } else {
      this.emit('wsEvent', event);
    }
  }

  emitOptimisticEvent(event) {
    this.emit('wsOptimisticEvent', event);
  }

  setSyncState(level, detail) {
    // Once failed, only a reconnect (or refresh) can clear it — individual
    // event successes and retries must not mask the lost-data state
    if (this.syncState === 'failed' && level !== 'failed') return;
    this.syncState = level;
    this.emit('syncWarning', {level, ...detail});
  }

  emitReconnect() {
    this.emit('reconnect');
  }

  async addEvent(event) {
    event.id = uuid.v4();
    this.emitOptimisticEvent(event);
    await this.connectToWebsocket();

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [5000, 10000, 20000];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.pushEventToWebsocket(event);
        this.setSyncState(null);
        return;
      } catch (err) {
        console.warn(`Event emit failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, err.message);
        if (attempt < MAX_RETRIES) {
          this.setSyncState('retrying', {retryIn: RETRY_DELAYS[attempt] / 1000});
          // Wait for the backoff delay OR socket reconnect, whichever comes first
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, RETRY_DELAYS[attempt]);
            if (this.socket && !this.socket.connected) {
              this.socket.once('connect', () => {
                clearTimeout(timeout);
                resolve();
              });
            }
          });
        }
      }
    }
    // all retries exhausted — freeze input, let socket.io keep trying to reconnect
    Sentry.captureException(new Error('Event delivery failed after all retries'));
    console.error('Event delivery failed after all retries');
    this.setSyncState('failed');
  }

  pushEventToWebsocket(event) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to websocket');
    }

    return emitAsyncWithTimeout(this.socket, 10000, 'game_event', {
      event,
      gid: this.gid,
    });
  }

  async subscribeToWebsocketEvents() {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to websocket');
    }

    this.socket.on('game_event', (event) => {
      event = castNullsToUndefined(event);
      this.emitWSEvent(event);
    });
    const response = await emitAsync(this.socket, 'sync_all_game_events', this.gid);
    response.forEach((event) => {
      event = castNullsToUndefined(event);
      this.emitWSEvent(event);
    });
  }

  async attach() {
    const websocketPromise = this.connectToWebsocket().then(() => this.subscribeToWebsocketEvents());
    await websocketPromise;
  }

  updateCell(r, c, id, color, pencil, value, autocheck) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'updateCell',
      params: {
        cell: {r, c},
        value,
        color,
        pencil,
        id,
        autocheck,
      },
    });
  }

  updateCursor(r, c, id) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'updateCursor',
      params: {
        timestamp: Date.now(),
        cell: {r, c},
        id,
      },
    });
  }

  addPing(r, c, id) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'addPing',
      params: {
        timestamp: Date.now(),
        cell: {r, c},
        id,
      },
    });
  }

  updateDisplayName(id, displayName) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'updateDisplayName',
      params: {
        id,
        displayName,
      },
    });
  }

  updateColor(id, color) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'updateColor',
      params: {
        id,
        color,
      },
    });
  }

  updateClock(action) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'updateClock',
      params: {
        action,
        timestamp: Date.now(),
      },
    });
  }

  check(scope) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'check',
      params: {
        scope,
      },
    });
  }

  reveal(scope) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'reveal',
      params: {
        scope,
      },
    });
  }

  reset(scope, force) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'reset',
      params: {
        scope,
        force,
      },
    });
  }

  markSolved() {
    this.addEvent({
      timestamp: Date.now(),
      type: 'markSolved',
      params: {},
    });
  }

  unmarkSolved() {
    this.addEvent({
      timestamp: Date.now(),
      type: 'unmarkSolved',
      params: {},
    });
  }

  chat(username, id, text) {
    this.addEvent({
      timestamp: Date.now(),
      type: 'chat',
      params: {
        text,
        senderId: id,
        sender: username,
      },
    });
    this.addEvent({
      timestamp: Date.now(),
      type: 'sendChatMessage', // send to fencing too
      params: {
        message: text,
        id,
        sender: username,
      },
    });
  }

  async initialize(rawGame) {
    console.log('initialize');
    const {
      info = {},
      grid = [[{}]],
      solution = [['']],
      circles = [],
      chat = {messages: []},
      cursor = {},
      clues = {},
      clock = {
        lastUpdated: 0,
        totalTime: 0,
        paused: true,
      },
      solved = false,
      themeColor = colors.MAIN_BLUE_3,
      pid,
    } = rawGame;

    // TODO validation

    const game = {
      info,
      grid,
      solution,
      circles,
      chat,
      cursor,
      clues,
      clock,
      solved,
      themeColor,
    };
    const version = CURRENT_VERSION;
    // nuke existing events

    this.ref.child('pid').set(pid);
    await this.eventsRef.set({});
    await this.addEvent({
      timestamp: Date.now(),
      type: 'create',
      params: {
        pid,
        version,
        game,
      },
    });
  }
}
