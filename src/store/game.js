/* eslint-disable no-param-reassign */
import EventEmitter from 'events';
import _ from 'lodash';
import * as uuid from 'uuid';
import * as colors from '../lib/colors';
import {recordServerTimeExchange, recordServerTimestamp} from '../lib/timing';
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

// Every Game that hasn't been detached. The socket is shared across the tab
// and the server tracks room membership per socket, not per Game, so a
// detached Game may leave a room only if no live Game still uses it — e.g.
// the page navigated away from a game and straight back to it.
const liveGames = new Set();

export default class Game extends EventEmitter {
  constructor(path) {
    super();
    window.game = this;
    this.path = path;
    this.createEvent = null;
    this.syncState = null; // null | 'retrying'
    this._flushing = false;
    // Ids of events sent straight to the socket whose ack hasn't come back.
    this._inFlight = new Set();
    this._socketHandlers = [];
    this._detached = false;
    this._leftRoom = false;
    liveGames.add(this);
  }

  // Stop this Game from hearing anything more: remove its handlers from the
  // shared socket, leave the room, and drop its own listeners. The page calls
  // this when it switches to another game or unmounts. Otherwise the old
  // Game keeps feeding its events, and on reconnect its whole resynced
  // history, into whichever game the page now shows.
  detach() {
    this._detached = true;
    liveGames.delete(this);
    if (this.socket) {
      this._socketHandlers.forEach(([name, handler]) => this.socket.off(name, handler));
    }
    this._socketHandlers = [];
    this.removeAllListeners();
    this._maybeLeaveRoom();
  }

  // Leave the room once a detached Game has nothing left to deliver. Leaving
  // any earlier would reject the edits still in flight: the server checks
  // room membership only after an await, so a leave_game sent right behind a
  // keystroke can land first and turn it into 'not in game'. With the
  // reconnect handler gone, that edit would then sit in the offline queue
  // until the player reopened this game. It does still have to leave: the
  // socket's game_event listener isn't per-game, so staying in the room would
  // feed this game's live events to the Game that replaced it. A live Game on
  // the same gid owns the room now, so in that case it stays.
  _maybeLeaveRoom() {
    if (!this._detached || this._leftRoom || this._inFlight.size > 0 || this._flushing) return;
    this._leftRoom = true;
    for (const game of liveGames) {
      if (game.gid === this.gid) return;
    }
    if (this.socket && this.socket.connected) this.socket.emit('leave_game', this.gid);
  }

  get gid() {
    // NOTE: path is a string that looks like "/game/39-vosk"
    return this.path.substring(6);
  }

  // Websocket code
  async connectToWebsocket() {
    if (this.socket || this._detached) return;
    const socket = await getSocket();
    if (this._detached) return;
    this.socket = socket;
    // The socket is shared by every Game in the tab, so each handler is
    // recorded for detach() to remove.
    const on = (name, handler) => {
      socket.on(name, handler);
      this._socketHandlers.push([name, handler]);
    };

    // Attach all long-lived listeners up-front, BEFORE the initial join.
    // socket.io preserves listeners across disconnect/connect on the same
    // Socket instance, so this also covers the bounce-during-initial-join
    // case: if setSocketAuthToken rebuilds the handshake while our first
    // join_game ack is in flight, the reconnect handler below still fires
    // on the same socket and recovers (re-joins + re-syncs). Previously
    // these listeners were registered AFTER the join await, so a bounce
    // during the await would leave the new transport with no listeners
    // and the page would sit blank waiting for the create event.
    on('disconnect', () => {
      console.log('received disconnect from server');
      // Force the reconnect handler to re-issue join_game before we
      // consider ourselves in the room again. Without resetting this, a
      // mid-session disconnect would leave _joined true and the next
      // pushEventToWebsocket would happily send game_event onto a socket
      // that doesn't have a room membership yet — server rejects with
      // 'not in game' and flushOfflineQueue silently drops the event.
      this._joined = false;
    });
    on('game_event', (event) => {
      event = castNullsToUndefined(event);
      // Live events are server-stamped, so each one is a fresh sample of the
      // offset between server time and this device's clock. The game clock
      // measures its live portion against that offset instead of a raw
      // Date.now(), so a skewed local clock doesn't show up as solve time.
      recordServerTimestamp(event.timestamp);
      this.emitWSEvent(event);
    });
    // Server broadcasts 'kicked' to the room when the owner kicks a player.
    on('kicked', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('kicked', msg);
      }
    });
    // Owner toggled one of the per-action restrictions (check/reveal/reset).
    // Forward to listeners so the Toolbar can flip the gating live without
    // having to refetch /moderation.
    on('restrictions_changed', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('restrictionsChanged', msg);
      }
    });
    // Owner locked or unlocked the game. The lock gate fires only on
    // join_game (existing players keep playing) so this is purely for
    // chat-side UX — showing players the room is now closed to new
    // joiners — and for keeping the owner-controls panel in sync across
    // tabs of the same account.
    on('lock_changed', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('lockChanged', msg);
      }
    });
    // And 'unkicked' when a kick is reversed, so other tabs can drop the
    // dfac_id from their local kicked list without a full reload.
    on('unkicked', (msg) => {
      if (msg && msg.gid === this.gid) {
        this.emit('unkicked', msg);
      }
    });
    // Reconnect handler — fires on every future 'connect' event on this
    // socket instance (the initial connect already fired before getSocket
    // resolved). Re-issues join_game, re-runs initial sync if it never
    // completed, and flushes queued events.
    on('connect', async () => {
      console.log('reconnecting...');
      const joinSentAt = Date.now();
      const ack = await emitAsync(socket, 'join_game', this.gid);
      const joinReceivedAt = Date.now();
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
      recordServerTimeExchange({
        sentAt: joinSentAt,
        serverReceivedAt: ack?.serverReceivedAt,
        serverSentAt: ack?.serverTime,
        receivedAt: joinReceivedAt,
      });
      this._joined = true;
      this.syncState = null;
      // Events broadcast while this socket was out of the room never reached
      // it, so a reconnect after the first sync fetches history again to pick
      // up other players' moves made during the gap. A game loaded from a
      // solved snapshot is skipped: its board and chat already include the
      // whole event log, and if someone has since chosen to keep the replay,
      // the server now returns that log, whose ids this client never saw —
      // replaying it would apply every event (each chat message) twice.
      if (!this._loadedFromSnapshot) {
        await this.syncAllGameEvents({resync: this._initialSyncCompleted});
      }
      await this.flushOfflineQueue();
      this.emitReconnect();
    });

    // Initial join. Use a timeout so a mid-flight socket bounce (its ack
    // never arrives) doesn't hang attach() forever — the reconnect handler
    // above will re-issue join_game on its own.
    try {
      const joinSentAt = Date.now();
      const joinAck = await emitAsyncWithTimeout(socket, 10000, 'join_game', this.gid);
      const joinReceivedAt = Date.now();
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
      // Seed the server/local clock offset before the first live event, so a
      // refresh mid-solve doesn't render the clock against a skewed device.
      // The timed exchange is what lets this correct the offset downward as
      // well as up — broadcast events can only ever raise it.
      recordServerTimeExchange({
        sentAt: joinSentAt,
        serverReceivedAt: joinAck?.serverReceivedAt,
        serverSentAt: joinAck?.serverTime,
        receivedAt: joinReceivedAt,
      });
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
    try {
      await this._sendEvent(event);
    } finally {
      this._maybeLeaveRoom();
    }
  }

  async _sendEvent(event) {
    event.id = uuid.v4();
    this.emitOptimisticEvent(event);
    await this.connectToWebsocket();

    // If queue is empty, try sending immediately
    if (loadOfflineQueue(this.gid).length === 0) {
      this._inFlight.add(event.id);
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
      } finally {
        this._inFlight.delete(event.id);
      }
    }

    // Persist to localStorage so the event survives page refreshes / long tunnels.
    // Re-load rather than reuse a copy read before the send: the send above
    // can wait up to 10s for its ack, and every keystroke typed in that window
    // takes the same direct path and saves itself here when its own ack times
    // out. Saving a stale copy would overwrite those events, and a lost event
    // never echoes back, so its optimistic copy stays on the board and wins
    // over every later edit to that cell.
    const queue = loadOfflineQueue(this.gid);
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
      this._maybeLeaveRoom();
    }
  }

  // Ids of every event that may still be echoed back by the server: queued,
  // or sent and awaiting an ack. Any optimistic event outside this set will
  // never be confirmed.
  pendingEventIds() {
    const ids = new Set(this._inFlight);
    loadOfflineQueue(this.gid).forEach((event) => ids.add(event.id));
    return ids;
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

  // `resync` replays history into a game that is already loaded: only events
  // HistoryWrapper can dedup by id are emitted, so the ones this client
  // already has are no-ops. The create event is skipped (re-emitting it would
  // rebuild the board), as are id-less events, which would be applied twice.
  async syncAllGameEvents({resync = false} = {}) {
    if (!this.socket || !this.socket.connected) return;
    const response = await emitAsync(this.socket, 'sync_all_game_events', this.gid);
    // Server returns an array of events on success, or {error: ...} on failure.
    // Only process and check for gameNotFound on a valid array response.
    if (!Array.isArray(response)) {
      console.error('sync_all_game_events returned error:', response);
      return;
    }
    if (resync) {
      response.forEach((event) => {
        if (event && event.id && event.type !== 'create') {
          this.emitWSEvent(castNullsToUndefined(event));
        }
      });
      return;
    }
    response.forEach((event) => {
      event = castNullsToUndefined(event);
      this.emitWSEvent(event);
    });
    if (response.some((event) => event && event.type === 'create')) {
      this._initialSyncCompleted = true;
      // getGameEvents answers for a solved, non-replay game with just the
      // create event, its game already marked solved from the snapshot. A
      // real create event is never solved.
      this._loadedFromSnapshot =
        response.length === 1 && response[0].type === 'create' && !!response[0].params?.game?.solved;
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
