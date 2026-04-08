/* eslint-disable no-param-reassign */
import EventEmitter from 'events';
import _ from 'lodash';
import * as uuid from 'uuid';
import * as colors from '../lib/colors';
import {emitAsync, emitAsyncWithTimeout} from '../sockets/emitAsync';
import {getSocket} from '../sockets/getSocket';
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

// ============ Offline Event Queue ========== //
// Persists unsent events to localStorage so they survive disconnects and page refreshes.

function offlineQueueKey(gid) {
  return `offline_queue_${gid}`;
}

function loadOfflineQueue(gid) {
  try {
    const raw = localStorage.getItem(offlineQueueKey(gid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(gid, queue) {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(offlineQueueKey(gid));
    } else {
      localStorage.setItem(offlineQueueKey(gid), JSON.stringify(queue));
    }
  } catch {
    // localStorage full or unavailable — events stay in memory only
  }
}

// a wrapper class that models Game

const CURRENT_VERSION = 1.0;
export default class Game extends EventEmitter {
  constructor(path) {
    super();
    window.game = this;
    this.path = path;
    this.createEvent = null;
    this.syncState = null; // null | 'retrying'
    this._flushing = false;
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
      this.syncState = null;
      await this.flushOfflineQueue();
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

    // If queue is empty, try sending immediately
    const queue = loadOfflineQueue(this.gid);
    if (queue.length === 0) {
      try {
        await this.pushEventToWebsocket(event);
        this.setSyncState(null);
        return;
      } catch {
        // Fall through to queuing logic
      }
    }

    // Persist to localStorage so the event survives page refreshes / long tunnels
    queue.push(event);
    saveOfflineQueue(this.gid, queue);
    console.log(`Queued event offline (${queue.length} pending)`);
    this.setSyncState('retrying', {retryIn: null});
    await this.flushOfflineQueue();
  }

  async flushOfflineQueue() {
    if (this._flushing) return;
    this._flushing = true;
    try {
      while (true) {
        const queue = loadOfflineQueue(this.gid);
        if (queue.length === 0) {
          this.setSyncState(null);
          break;
        }

        const event = queue[0];
        try {
          await this.pushEventToWebsocket(event);
          // Re-load to avoid overwriting events added concurrently by addEvent
          const currentQueue = loadOfflineQueue(this.gid);
          if (currentQueue.length > 0 && currentQueue[0].id === event.id) {
            currentQueue.shift();
            saveOfflineQueue(this.gid, currentQueue);
          }
        } catch (err) {
          console.warn('Failed to flush offline event:', err.message);
          this.setSyncState('retrying', {retryIn: null});
          break; // Stop on first failure to preserve event order
        }
      }
    } finally {
      this._flushing = false;
    }
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
    // Server returns an array of events on success, or {error: ...} on failure.
    // Only process and check for gameNotFound on a valid array response.
    if (!Array.isArray(response)) {
      console.error('sync_all_game_events returned error:', response);
      return;
    }
    response.forEach((event) => {
      event = castNullsToUndefined(event);
      this.emitWSEvent(event);
    });
    if (!response.some((event) => event && event.type === 'create')) {
      this.emit('gameNotFound');
    }
  }

  async attach() {
    const websocketPromise = this.connectToWebsocket().then(async () => {
      await this.flushOfflineQueue();
      await this.subscribeToWebsocketEvents();
    });
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
