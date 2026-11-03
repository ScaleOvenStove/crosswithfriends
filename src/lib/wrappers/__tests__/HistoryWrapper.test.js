import HistoryWrapper from '../HistoryWrapper';

// A minimal reducer: the game is the list of applied cell values.
const reducer = (game, event) => (event.type === 'create' ? [] : [...game, event.value]);

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
