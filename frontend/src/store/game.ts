import EventEmitter from './EventEmitter';
import _ from 'lodash';
import io from 'socket.io-client';
import * as uuid from 'uuid';
import * as colors from '@crosswithfriends/shared/lib/colors';
import {emitAsync} from '../sockets/emitAsync';
import {getSocket} from '../sockets/getSocket';
import {db, SERVER_TIME, type DatabaseReference} from './firebase';
import {ref, onValue, off, get, set} from 'firebase/database';

// ============ Serialize / Deserialize Helpers ========== //

// Recursively walks obj and converts `null` to `undefined`
const castNullsToUndefined = (obj: any): any => {
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
  path: string;
  ref: DatabaseReference;
  eventsRef: DatabaseReference;
  createEvent: any;
  socket?: io.Socket;

  constructor(path: string) {
    super();
    (window as any).game = this;
    this.path = path;
    this.ref = ref(db, path);
    this.eventsRef = ref(db, `${path}/events`);
    this.createEvent = null;
    this.checkArchive();
  }

  get gid(): string {
    // NOTE: path is a string that looks like "/game/39-vosk"
    return this.path.substring(6);
  }

  // Websocket code
  async connectToWebsocket(): Promise<void> {
    if (this.socket) return;
    const socket = await getSocket();
    this.socket = socket;

    // Register event handlers BEFORE async operations to avoid missing events
    // Following Socket.io best practice: register handlers outside connect event
    socket.on('disconnect', () => {
      console.log('received disconnect from server');
    });

    // Handle reconnects - registered once, outside connect event to avoid duplicates
    socket.on('connect', async () => {
      console.log('reconnecting...');
      await emitAsync(socket, 'join_game', this.gid);
      console.log('reconnected...');
      this.emitReconnect();
    });

    // Join game after handlers are registered
    await emitAsync(socket, 'join_game', this.gid);
  }

  emitEvent(event: any): void {
    if (event.type === 'create') {
      this.emit('createEvent', event);
    } else {
      this.emit('event', event);
    }
  }

  emitWSEvent(event: any): void {
    if (event.type === 'create') {
      this.emit('wsCreateEvent', event);
      console.log('Connected!');
    } else {
      this.emit('wsEvent', event);
    }
  }

  emitOptimisticEvent(event: any): void {
    this.emit('wsOptimisticEvent', event);
  }

  emitReconnect(): void {
    this.emit('reconnect');
  }

  async addEvent(event: any): Promise<void> {
    event.id = uuid.v4();
    this.emitOptimisticEvent(event);
    await this.connectToWebsocket();
    await this.pushEventToWebsocket(event);
  }

  pushEventToWebsocket(event: any): Promise<any> {
    if (!this.socket || !this.socket.connected) {
      if (this.socket) {
        (this.socket as any).close().open(); // HACK try to fix the disconnection bug
      }
      throw new Error('Not connected to websocket');
    }

    return emitAsync(this.socket, 'game_event', {
      event,
      gid: this.gid,
    });
  }

  async subscribeToWebsocketEvents(): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to websocket');
    }

    this.socket.on('game_event', (event: any) => {
      const processedEvent = castNullsToUndefined(event);
      this.emitWSEvent(processedEvent);
    });
    const response = await emitAsync(this.socket, 'sync_all_game_events', this.gid);
    response.forEach((event: any) => {
      const processedEvent = castNullsToUndefined(event);
      this.emitWSEvent(processedEvent);
    });
  }

  // Firebase Code

  checkArchive(): void {
    get(ref(db, `${this.path}/archivedEvents`)).then((snapshot) => {
      const archiveInfo = snapshot.val();
      if (!archiveInfo) {
        return;
      }
      const {unarchivedAt} = archiveInfo;
      if (!unarchivedAt) {
        if (window.confirm('Unarchive game?')) {
          this.unarchive();
        }
      }
    });
  }

  unarchive(): void {
    get(ref(db, `${this.path}/archivedEvents`)).then(async (snapshot) => {
      const archiveInfo = snapshot.val();
      if (!archiveInfo) {
        return;
      }
      const {url} = archiveInfo;
      if (url) {
        const events = await (await fetch(url)).json();
        await set(ref(db, `${this.path}/archivedEvents/unarchivedAt`), SERVER_TIME);
        await set(ref(db, `${this.path}/events`), events);
      }
    });
  }

  async attach(): Promise<void> {
    const battleDataRef = ref(db, `${this.path}/battleData`);
    onValue(battleDataRef, (snapshot) => {
      this.emit('battleData', snapshot.val());
    });

    console.log('subscribed');

    const websocketPromise = this.connectToWebsocket().then(() => this.subscribeToWebsocketEvents());
    await websocketPromise;
  }

  detach(): void {
    off(this.eventsRef);
  }

  updateCell(
    r: number,
    c: number,
    id: string,
    color: string,
    pencil: boolean,
    value: string,
    autocheck: boolean
  ): void {
    this.addEvent({
      timestamp: SERVER_TIME,
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

  updateCursor(r: number, c: number, id: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'updateCursor',
      params: {
        timestamp: SERVER_TIME,
        cell: {r, c},
        id,
      },
    });
  }

  addPing(r: number, c: number, id: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'addPing',
      params: {
        timestamp: SERVER_TIME,
        cell: {r, c},
        id,
      },
    });
  }

  updateDisplayName(id: string, displayName: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'updateDisplayName',
      params: {
        id,
        displayName,
      },
    });
  }

  updateColor(id: string, color: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'updateColor',
      params: {
        id,
        color,
      },
    });
  }

  updateClock(action: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'updateClock',
      params: {
        action,
        timestamp: SERVER_TIME,
      },
    });
  }

  check(scope: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'check',
      params: {
        scope,
      },
    });
  }

  reveal(scope: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'reveal',
      params: {
        scope,
      },
    });
  }

  reset(scope: string, force: boolean): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'reset',
      params: {
        scope,
        force,
      },
    });
  }

  chat(username: string, id: string, text: string): void {
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'chat',
      params: {
        text,
        senderId: id,
        sender: username,
      },
    });
    this.addEvent({
      timestamp: SERVER_TIME,
      type: 'sendChatMessage', // send to fencing too
      params: {
        message: text,
        id,
        sender: username,
      },
    });
  }

  async initialize(rawGame: any, {battleData}: {battleData?: any} = {}): Promise<void> {
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

    await set(ref(db, `${this.path}/pid`), pid);
    await set(this.eventsRef, {});
    await this.addEvent({
      timestamp: SERVER_TIME,
      type: 'create',
      params: {
        pid,
        version,
        game,
      },
    });

    if (battleData) {
      await set(ref(db, `${this.path}/battleData`), battleData);
    }
  }
}
