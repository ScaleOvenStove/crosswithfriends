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

  it('keeps optimistic events that are still pending', () => {
    const history = makeWrapper();
    history.addOptimisticEvent({id: 'queued', value: 'L'});
    history.addOptimisticEvent({id: 'lost', value: 'X'});

    history.retainOptimisticEvents(new Set(['queued']));
    expect(history.getSnapshot()).toEqual(['L']);
  });
});
