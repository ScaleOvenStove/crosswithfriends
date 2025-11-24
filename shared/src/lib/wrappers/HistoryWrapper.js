import {reduce as gameReducer} from '../reducers/game';

const MEMO_RATE = 10;

// Helper: Binary search to find insertion point in sorted array
const sortedLastIndexBy = (array, value, iteratee) => {
  let low = 0;
  let high = array.length;
  const computed = typeof iteratee === 'function' ? iteratee(value) : value[iteratee];

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midValue = typeof iteratee === 'function' ? iteratee(array[mid]) : array[mid][iteratee];
    if (midValue <= computed) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export default class HistoryWrapper {
  constructor(history = [], reducer = gameReducer) {
    window.historyWrapper = this;
    this.reducer = reducer;
    this.history = [];
    this.optimisticEvents = [];
    this.memo = [];
    this.createEvent = null;
    history.forEach((event) => {
      if (event.type === 'create') {
        this.setCreateEvent(event);
      } else {
        this.addEvent(event);
      }
    });
  }

  get reduce() {
    return this.reducer;
  }

  get ready() {
    return !!this.createEvent;
  }

  initializeMemo() {
    if (!this.createEvent) {
      return;
    }
    this.memo = [
      {
        index: -1,
        game: this.reduce(null, this.createEvent),
      },
    ];

    Array.from({length: this.history.length}, (_, index) => index).forEach((index) => {
      this.memoize(index);
    });
  }

  memoize(index) {
    const lastMemo = this.memo[this.memo.length - 1];
    if (lastMemo && index <= lastMemo.index) {
      console.error('tried to memoize out of order');
      return;
    }
    const game = this.getSnapshotAtIndex(index);
    this.memo.push({
      game,
      index,
    });
  }

  // returns result of [0, index]
  getSnapshotAtIndex(index, {optimistic = false} = {}) {
    const _i = sortedLastIndexBy(this.memo, {index}, (memoItem) => memoItem.index);
    const memoItem = this.memo[_i - 1];

    // Handle case where memo is empty or index is out of bounds
    if (!memoItem) {
      // If no memo item, start from createEvent
      if (!this.createEvent) {
        return null;
      }
      let game = this.reduce(null, this.createEvent);
      for (let i = 0; i <= index; i += 1) {
        const event = this.history[i];
        if (event) {
          game = this.reduce(game, event);
        }
      }
      if (optimistic) {
        for (const event of this.optimisticEvents) {
          game = this.reduce(game, event, {
            isOptimistic: true,
          });
        }
      }
      return game;
    }

    let {game} = memoItem;
    for (let i = memoItem.index + 1; i <= index; i += 1) {
      const event = this.history[i];
      if (event) {
        game = this.reduce(game, event);
      }
    }
    if (optimistic) {
      for (const event of this.optimisticEvents) {
        game = this.reduce(game, event, {
          isOptimistic: true,
        });
      }
    }

    return game;
  }

  // the current snapshot
  getSnapshot() {
    return this.getSnapshotAtIndex(this.history.length - 1, {optimistic: true});
  }

  // this is used for replay
  getSnapshotAt(gameTimestamp) {
    // compute the number of events that have happened
    const index = sortedLastIndexBy(this.history, {gameTimestamp}, (event) => event.gameTimestamp);
    return this.getSnapshotAtIndex(index - 1);
  }

  setCreateEvent(event) {
    this.createEvent = event;
    event.gameTimestamp = 0;
    this.initializeMemo();
  }

  addEvent(event) {
    window.timeStampOffset = event.timestamp - Date.now();
    this.optimisticEvents = this.optimisticEvents.filter((ev) => ev.id !== event.id);
    // we must support retroactive updates to the event log
    const insertPoint = sortedLastIndexBy(this.history, event, (event) => event.timestamp);
    this.history.splice(insertPoint, 0, event);
    if (!this.createEvent) {
      return;
    }
    while (this.memo.length > 0 && this.memo[this.memo.length - 1].index >= insertPoint) {
      this.memo.pop();
    }
    for (let index = 0; index < this.history.length; index += MEMO_RATE) {
      const lastMemo = this.memo[this.memo.length - 1];
      if (lastMemo && index > lastMemo.index) {
        this.memoize(index);
      }
    }
    const snapshot = this.getSnapshotAtIndex(insertPoint);
    if (snapshot.clock) {
      event.gameTimestamp = snapshot.clock.trueTotalTime;
    }
  }

  addOptimisticEvent(event) {
    const lastHistory = this.history[this.history.length - 1];
    event = {
      ...event,
      timestamp: (lastHistory?.timestamp ?? 0) + this.optimisticEvents.length + 1000,
    };
    setTimeout(() => {
      if (this.optimisticEvents.includes(event)) {
        console.log('Detected websocket drop, reconnecting...');
        this.optimisticEvents = [];
        alert('disconnected, please refresh');
        window.socket.close();
        window.socket.open();
      }
    }, 5000);
    this.optimisticEvents.push(event);
  }

  clearOptimisticEvents() {
    this.optimisticEvents = [];
  }
}
