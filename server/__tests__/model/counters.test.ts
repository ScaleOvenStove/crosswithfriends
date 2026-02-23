import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {incrementGid, incrementPid} from '../../model/counters';

describe('incrementGid', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('queries nextval for gid_counter', async () => {
    pool.query.mockResolvedValueOnce({rows: [{nextval: '42'}]});
    await incrementGid();
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain("nextval('gid_counter')");
  });

  it('returns the nextval as a string', async () => {
    pool.query.mockResolvedValueOnce({rows: [{nextval: '123'}]});
    const result = await incrementGid();
    expect(result).toBe('123');
  });
});

describe('incrementPid', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('queries nextval for pid_counter', async () => {
    pool.query.mockResolvedValueOnce({rows: [{nextval: '7'}]});
    await incrementPid();
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain("nextval('pid_counter')");
  });

  it('returns the nextval as a string', async () => {
    pool.query.mockResolvedValueOnce({rows: [{nextval: '999'}]});
    const result = await incrementPid();
    expect(result).toBe('999');
  });
});
