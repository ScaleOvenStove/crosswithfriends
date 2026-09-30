import express from 'express';
import request from 'supertest';

jest.mock('../../model/puzzle', () => ({
  listPuzzles: jest.fn().mockResolvedValue([]),
}));

import {listPuzzles} from '../../model/puzzle';
import puzzleListRouter from '../../api/puzzle_list';

function buildApp() {
  const app = express();
  // Mirrors server.ts: filter[sortBy]=... only parses as nested with qs.
  app.set('query parser', 'extended');
  app.use('/puzzle_list', puzzleListRouter);
  return app;
}

async function sortByFor(query: string) {
  const res = await request(buildApp()).get(`/puzzle_list?page=0&pageSize=10${query}`);
  expect(res.status).toBe(200);
  const mock = listPuzzles as jest.Mock;
  return mock.mock.calls[mock.mock.calls.length - 1][0].sortBy;
}

describe('GET /puzzle_list sortBy parsing', () => {
  it.each(['rating_desc', 'rating_asc', 'time_desc', 'time_asc'])('passes %s through', async (sortBy) => {
    expect(await sortByFor(`&filter[sortBy]=${sortBy}`)).toBe(sortBy);
  });

  it('falls back to default for an unknown value', async () => {
    expect(await sortByFor('&filter[sortBy]=DROP%20TABLE')).toBe('default');
  });

  it('falls back to default when sortBy is missing', async () => {
    expect(await sortByFor('')).toBe('default');
  });
});
