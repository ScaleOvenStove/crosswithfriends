import HistoryWrapper from '../HistoryWrapper';

// A minimal reducer: the game is the list of applied cell values.
const reducer = (game, event) => (event.type === 'create' ? [] : [...game, event.value]);

function makeWrapper() {
  return new HistoryWrapper([{type: 'create', timestamp: 0}], reducer);
}

describe('retainOptimisticEvents', () => {
  it('stops replaying an optimistic event the server will never confirm', () => {
    const history = makeWrapper();
    // 'L' was lost in transit; 'E' was sent and confirmed afterwards.
    history.addOptimisticEvent({id: 'lost', value: 'L'});
    history.addOptimisticEvent({id: 'sent', value: 'E'});
    history.addEvent({id: 'sent', value: 'E', timestamp: 10});

    // The orphan is replayed on top of the confirmed edit: the cell reverts.
    expect(history.getSnapshot()).toEqual(['E', 'L']);

    history.retainOptimisticEvents(new Set());
    expect(history.getSnapshot()).toEqual(['E']);
  });

  it('keeps a letter whose echo only arrived through a resync', () => {
    const history = makeWrapper();
    history.addOptimisticEvent({id: 'other-tab', value: 'L'});
    // A reconnect resync brings in the event another tab sent for us...
    history.addEvent({id: 'other-tab', value: 'L', timestamp: 10});
    // ...so the cleanup that follows has nothing left to drop.
    history.retainOptimisticEvents(new Set());
    expect(history.getSnapshot()).toEqual(['L']);
  });

  it('keeps optimistic events that are still pending', () => {
    const history = makeWrapper();
    history.addOptimisticEvent({id: 'queued', value: 'L'});
    history.addOptimisticEvent({id: 'lost', value: 'X'});

    history.retainOptimisticEvents(new Set(['queued']));
    expect(history.getSnapshot()).toEqual(['L']);
  });
});

describe('HistoryWrapper dedup', () => {
  it('applies a replayed event only once', () => {
    const history = new HistoryWrapper([{type: 'create', timestamp: 0}], reducer);
    history.addEvent({id: 'a', value: 'A', timestamp: 1});
    history.addEvent({id: 'b', value: 'B', timestamp: 2});
    // A reconnect resync replays the whole game.
    history.addEvent({id: 'a', value: 'A', timestamp: 1});
    history.addEvent({id: 'b', value: 'B', timestamp: 2});
    history.addEvent({id: 'c', value: 'C', timestamp: 3});

    expect(history.getSnapshot()).toEqual(['A', 'B', 'C']);
  });

  it('confirms the optimistic copy when its echo is a duplicate', () => {
    const history = new HistoryWrapper([{type: 'create', timestamp: 0}], reducer);
    history.addEvent({id: 'a', value: 'A', timestamp: 1});
    history.addOptimisticEvent({id: 'a', value: 'A'});
    history.addEvent({id: 'a', value: 'A', timestamp: 5});

    expect(history.optimisticEvents).toEqual([]);
    expect(history.getSnapshot()).toEqual(['A']);
  });
});
