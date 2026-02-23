import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {saveGameSnapshot, getGameSnapshot, setReplayRetained} from '../../model/game_snapshot';

describe('saveGameSnapshot', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('passes JSON.stringify of the snapshot object', async () => {
    const snapshot = {grid: [[{value: 'A'}]], solved: true};
    await saveGameSnapshot('g1', 'p1', snapshot);
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[2]).toBe(JSON.stringify(snapshot));
  });

  it('uses ON CONFLICT upsert in the SQL', async () => {
    await saveGameSnapshot('g1', 'p1', {});
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE');
  });

  it('defaults replayRetained to false', async () => {
    await saveGameSnapshot('g1', 'p1', {});
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('g1');
    expect(params[1]).toBe('p1');
    expect(params[3]).toBe(false);
  });

  it('passes replayRetained when explicitly set to true', async () => {
    await saveGameSnapshot('g1', 'p1', {}, true);
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[3]).toBe(true);
  });
});

describe('getGameSnapshot', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns mapped object when found', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{gid: 'g1', pid: 'p1', snapshot: {grid: []}, replay_retained: true}],
    });
    const result = await getGameSnapshot('g1');
    expect(result).toEqual({
      gid: 'g1',
      pid: 'p1',
      snapshot: {grid: []},
      replayRetained: true,
    });
  });

  it('returns null when no rows', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await getGameSnapshot('nonexistent');
    expect(result).toBeNull();
  });
});

describe('setReplayRetained', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns true when update affects a row', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 1});
    const result = await setReplayRetained('g1', true);
    expect(result).toBe(true);
  });

  it('returns false when gid does not exist', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 0});
    const result = await setReplayRetained('nonexistent', true);
    expect(result).toBe(false);
  });
});
