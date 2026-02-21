import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {getInProgressGames} from '../../model/puzzle_solve';

describe('getInProgressGames', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns empty array (disabled until game_participants table exists)', async () => {
    const result = await getInProgressGames('user-123');

    expect(result).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
