/* eslint-disable no-param-reassign */
import EventEmitter from 'events';
import _ from 'lodash';
import * as uuid from 'uuid';
import * as colors from '../lib/colors';
import {emitAsync, emitAsyncWithTimeout} from '../sockets/emitAsync';
import {getSocket, resetSocket} from '../sockets/getSocket';
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

// Errors from join_game that should permanently fail the connection (the
// page shows a blocker screen and doesn't retry). Anything else — most
// notably the server's catch-all 'internal error' — is transient and should
// fall through so the socket reconnect machinery can retry.
const TERMINAL_JOIN_ERRORS = new Set(['banned', 'locked']);
function isTerminalJoinError(error) {
  return TERMINAL_JOIN_ERRORS.has(error);
}

// game_event ack errors that the server will never accept on retry. These
// must be dropped from the offline queue so they don't loop forever and
// stall later events behind them. 'restricted' = owner gated this action
// type; 'banned' = caller was kicked (also triggers forceDisconnect via
// the 'kicked' broadcast, but defensive); 'create not allowed over socket'
// is a protocol error that retries can't fix.
const TERMINAL_EVENT_REJECTIONS = new Set(['restricted', 'banned', 'create not allowed over socket']);
function isTerminalEventRejection(error) {
  return TERMINAL_EVENT_REJECTIONS.has(error);
}

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

    // Attach all long-lived listeners up-front, BEFORE the initial join.
    // socket.io preserves listeners across disconnect/connect on the same
    // Socket instance, so this also covers the bounce-during-initial-join
    // case: if setSocketAuthToken rebuilds the handshake while our first
    // join_game ack is in flight, the reconnect handler below still fires
    // on the same socket and recovers (re-joins + re-syncs). Previously
    // these listeners were registered AFTER the join await, so a bounce
    // during the await would leave the new transport with no listeners
    // and the page would sit blank waiting for the create event.
    socket.on('disconnect', () => {
      console.log('received disconnect from server');
      // Force the reconnect handler to re-issue join_game before we
      // consider ourselves in the room again. Without resetting this, a
      // mid-session disconnect would leave _joined true and the next
      // pushEventToWebsocket would happily send game_event onto a socket
      // that doesn't have a room membership yet — server rejects with
      // 'not in game' and flushOfflineQueue silently drops the event.
      this._joined = false;
    });
    socket.on('game_event', (event) => {
      event = castNullsToUndefined(event);
      this.emitWSEvent(event);
    });
    // Server broadcasts 'kicked' to the room when the owner kicks a player.
    socket.on('kicked', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('kicked', msg);
      }
    });
    // Owner toggled one of the per-action restrictions (check/reveal/reset).
    // Forward to listeners so the Toolbar can flip the gating live without
    // having to refetch /moderation.
    socket.on('restrictions_changed', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('restrictionsChanged', msg);
      }
    });
    // Owner locked or unlocked the game. The lock gate fires only on
    // join_game (existing players keep playing) so this is purely for
    // chat-side UX — showing players the room is now closed to new
    // joiners — and for keeping the owner-controls panel in sync across
    // tabs of the same account.
    socket.on('lock_changed', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('lockChanged', msg);
      }
    });
    // And 'unkicked' when a kick is reversed, so other tabs can drop the
    // dfac_id from their local kicked list without a full reload.
    socket.on('unkicked', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('unkicked', msg);
      }
    });
    // Reconnect handler — fires on every future 'connect' event on this
    // socket instance (the initial connect already fired before getSocket
    // resolved). Re-issues join_game, re-runs initial sync if it never
    // completed, and flushes queued events.
    socket.on('connect', async () => {
      console.log('reconnecting...');
      const ack = await emitAsync(socket, 'join_game', this.gid);
      if (ack && ack.error) {
        if (isTerminalJoinError(ack.error)) {
          this.joinRejected = ack.error;
          this.emit('joinRejected', {reason: ack.error, gid: this.gid});
          return;
        }
        // Non-terminal (e.g. 'internal error'). The socket isn't in the
        // room — running flushOfflineQueue here would send game_event emits
        // that the server rejects with 'not in game', and the flush treats
        // a non-throwing ack as success and removes events from localStorage.
        // Skip sync/flush entirely; the next reconnect will retry join_game.
        console.warn('join_game on reconnect returned non-terminal error, skipping sync/flush:', ack.error);
        return;
      }
      console.log('reconnected...');
      this._joined = true;
      this.syncState = null;
      if (!this._initialSyncCompleted) {
        await this.syncAllGameEvents();
      }
      await this.flushOfflineQueue();
      this.emitReconnect();
    });

    // Initial join. Use a timeout so a mid-flight socket bounce (its ack
    // never arrives) doesn't hang attach() forever — the reconnect handler
    // above will re-issue join_game on its own.
    try {
      const joinAck = await emitAsyncWithTimeout(socket, 10000, 'join_game', this.gid);
      if (joinAck && joinAck.error) {
        if (isTerminalJoinError(joinAck.error)) {
          // Server refused (banned/locked). Mark this connection terminal so
          // attach()'s caller skips flushOfflineQueue + the initial sync.
          this.joinRejected = joinAck.error;
          this.emit('joinRejected', {reason: joinAck.error, gid: this.gid});
          return;
        }
        // Non-terminal (e.g. 'internal error'). Leave _joined false so
        // attach() skips flush/sync — flushing on a socket that isn't in
        // the room would get every event acked with 'not in game' and
        // flushOfflineQueue would silently drop them from localStorage.
        // The reconnect handler will retry join_game.
        console.warn('join_game returned non-terminal error:', joinAck.error);
        return;
      }
      this._joined = true;
    } catch (e) {
      // Ack lost mid-flight (bounce, transient network) — leave _joined
      // false. The reconnect handler will retry and set it then.
      console.warn('Initial join_game ack timed out; reconnect handler will retry:', e?.message);
    }
  }

  // Called when the local user is the kick target — drop the live socket
  // so they stop receiving live updates/chat even though the server-side
  // ban also blocks outgoing events. Matches the UX of being booted.
  // Also reset the module-level socket promise: getSocket() caches the
  // socket globally, so without this, navigating to another game in the
  // same SPA tab would reuse the now-disconnected socket and never sync.
  forceDisconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    resetSocket();
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
        const ack = await this.pushEventToWebsocket(event);
        // Server rejection (e.g. 'not in game') resolves the Promise — don't
        // mistake it for success and lose the event. Fall through to queue
        // for transient rejections; bail without queuing for terminal ones.
        if (ack && ack.error) {
          if (isTerminalEventRejection(ack.error)) {
            this.emit('eventRejected', {event, reason: ack.error});
            return;
          }
          throw new Error(`server rejected event: ${ack.error}`);
        }
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
          const ack = await this.pushEventToWebsocket(event);
          // The server sends {error: ...} on rejection. Two kinds:
          // - Terminal (e.g. 'restricted'): the server will never accept
          //   this event. Drop it from the queue so we don't loop on it
          //   forever and stall every later event behind it.
          // - Transient (e.g. 'not in game' during a reconnect, or
          //   'internal error'): keep the event and retry once the
          //   underlying issue resolves.
          if (ack && ack.error) {
            if (isTerminalEventRejection(ack.error)) {
              console.warn(`Server rejected event terminally (${ack.error}); dropping from queue`);
              const currentQueue = loadOfflineQueue(this.gid);
              if (currentQueue.length > 0 && currentQueue[0].id === event.id) {
                currentQueue.shift();
                saveOfflineQueue(this.gid, currentQueue);
              }
              this.emit('eventRejected', {event, reason: ack.error});
              continue; // Try the next queued event
            }
            throw new Error(`server rejected event: ${ack.error}`);
          }
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
    // game_event listener is now attached up-front in connectToWebsocket,
    // so this is just the initial history sync. We let the call no-op
    // silently if we're disconnected — the reconnect handler in
    // connectToWebsocket will redrive sync once the socket comes back.
    if (!this.socket || !this.socket.connected) return;
    await this.syncAllGameEvents();
  }

  async syncAllGameEvents() {
    if (!this.socket || !this.socket.connected) return;
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
    if (response.some((event) => event && event.type === 'create')) {
      this._initialSyncCompleted = true;
      this.emit('gameReady');
    } else {
      this.emit('gameNotFound');
    }
  }

  async attach() {
    const websocketPromise = this.connectToWebsocket().then(async () => {
      // join_game was rejected (banned/locked). Don't flush queued events
      // (server would reject them anyway) and don't sync history.
      if (this.joinRejected) return;
      // Non-terminal join failure (transient/timeout). Skip flush+sync —
      // the server rejects game_event from sockets not in the room and
      // flushOfflineQueue would treat each rejection as success, silently
      // dropping queued events. The reconnect handler will retry.
      if (!this._joined) return;
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
