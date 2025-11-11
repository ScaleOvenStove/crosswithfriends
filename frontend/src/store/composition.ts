import _ from 'lodash';
import EventEmitter from './EventEmitter';

import {db, SERVER_TIME, type DatabaseReference} from './firebase';
import {ref, onChildAdded, off, push, set} from 'firebase/database';

// a wrapper class that models Composition
//
export const CURRENT_VERSION = 1.0;
export default class Composition extends EventEmitter {
  ref: DatabaseReference;
  events: DatabaseReference;
  path: string;
  createEvent: any;
  attached: boolean;

  constructor(path: string) {
    super();
    this.path = path;
    this.ref = ref(db, path);
    this.events = ref(db, `${path}/events`);
    this.createEvent = null;
    this.attached = false;
  }

  attach(): void {
    onChildAdded(this.events, (snapshot) => {
      const event = snapshot.val();
      if (event.type === 'create') {
        this.createEvent = event;
        this.attached = true;
        this.emit('createEvent', event);
      } else {
        this.emit('event', event);
      }
    });
  }

  detach(): void {
    off(this.events);
  }

  updateCellText(r: number, c: number, value: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateCellText',
      params: {
        cell: {r, c},
        value,
      },
    });
  }

  updateCellColor(r: number, c: number, color: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateCellColor',
      params: {
        cell: {r, c},
        color,
      },
    });
  }

  updateClue(r: number, c: number, dir: string, value: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateClue',
      params: {
        cell: {r, c},
        dir,
        value,
      },
    });
  }

  updateCursor(r: number, c: number, id: string, color: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateCursor',
      params: {
        timestamp: SERVER_TIME,
        cell: {r, c},
        color,
        id,
      },
    });
  }

  updateTitle(text: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateTitle',
      params: {
        text,
      },
    });
  }

  updateAuthor(text: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateAuthor',
      params: {
        text,
      },
    });
  }

  chat(username: string, id: string, text: string): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'chat',
      params: {
        text,
        senderId: id,
        sender: username,
      },
    });
  }

  import(filename: string, contents: any): void {
    const {info, grid, circles, clues} = contents;
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateComposition',
      params: {
        filename, // unused, for now
        info,
        grid,
        circles,
        clues,
      },
    });
  }

  setGrid(grid: any): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateGrid',
      params: {
        grid,
      },
    });
  }

  clearPencil(): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'clearPencil',
      params: {},
    });
  }

  updateDimensions(
    width: number,
    height: number,
    {fromX = 'right', fromY = 'down'}: {fromX?: string; fromY?: string} = {}
  ): void {
    push(this.events, {
      timestamp: SERVER_TIME,
      type: 'updateDimensions',
      params: {
        width,
        height,
        fromX,
        fromY,
      },
    });
  }

  initialize(rawComposition: any = {}): Promise<void> {
    const {
      info = {
        title: 'Untitled',
        author: 'Anonymous',
      },
      grid = _.range(7).map(() =>
        _.range(7).map(() => ({
          value: '',
        }))
      ),
      clues = [],
      circles = [],
      chat = {messages: []},
      cursor = {},
    } = rawComposition;

    // TODO validation

    const composition = {
      info,
      grid,
      clues,
      circles,
      chat,
      cursor,
    };
    const version = CURRENT_VERSION;
    // nuke existing events
    return set(this.events, {})
      .then(() =>
        push(this.events, {
          timestamp: SERVER_TIME,
          type: 'create',
          params: {
            version,
            composition,
          },
        })
      )
      .then(() => set(ref(db, `${this.path}/published`), false));
  }
}
