import {pool, resetPoolMocks} from '../../__mocks__/pool';

// Mock the pool module before importing the module under test
jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {listPuzzles, getUserUploadedPuzzles} from '../../model/puzzle';

describe('listPuzzles', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  const defaultFilter = {
    nameOrTitleFilter: '',
    sizeFilter: {Mini: true, Midi: true, Standard: true, Large: true},
    typeFilter: {Standard: true, Cryptic: true, Contest: true},
    dayOfWeekFilter: {
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: true,
      Sun: true,
      Unknown: true,
    },
  };

  it('queries only public puzzles when no userId is provided', async () => {
    pool.query.mockResolvedValue({rows: []});

    await listPuzzles(defaultFilter, 50, 0);

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('is_public = true');
    expect(sql).not.toContain('uploaded_by');
  });

  it('includes user unlisted puzzles when userId is provided', async () => {
    pool.query.mockResolvedValue({rows: []});
    const userId = 'user-123';

    await listPuzzles(defaultFilter, 50, 0, userId);

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('is_public = true OR uploaded_by =');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params).toContain(userId);
  });

  it('passes limit and offset as first two parameters', async () => {
    pool.query.mockResolvedValue({rows: []});

    await listPuzzles(defaultFilter, 25, 100);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe(25);
    expect(params[1]).toBe(100);
  });

  it('maps times_solved from string to number', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'abc',
          uploaded_at: '2024-01-01',
          is_public: true,
          content: {info: {title: 'Test', author: 'A'}, grid: [['']], clues: {across: [], down: []}},
          times_solved: '42',
        },
      ],
    });

    const result = await listPuzzles(defaultFilter, 50, 0);

    expect(result[0].times_solved).toBe(42);
    expect(typeof result[0].times_solved).toBe('number');
  });

  it('includes is_public in returned results', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'abc',
          uploaded_at: '2024-01-01',
          is_public: false,
          content: {info: {title: 'Test', author: 'A'}, grid: [['']], clues: {across: [], down: []}},
          times_solved: '0',
        },
      ],
    });

    const result = await listPuzzles(defaultFilter, 50, 0, 'user-123');

    expect(result[0].is_public).toBe(false);
  });

  it('selects is_public column in query', async () => {
    pool.query.mockResolvedValue({rows: []});

    await listPuzzles(defaultFilter, 50, 0);

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('is_public');
  });

  it('builds name/title filter with ILIKE parameters', async () => {
    pool.query.mockResolvedValue({rows: []});
    const filter = {...defaultFilter, nameOrTitleFilter: 'monday mini'};

    await listPuzzles(filter, 50, 0);

    const params = pool.query.mock.calls[0][1] as any[];
    // First two params are limit/offset, then the search tokens
    expect(params[2]).toBe('%monday%');
    expect(params[3]).toBe('%mini%');
  });

  it('applies size filter when not all sizes selected', async () => {
    pool.query.mockResolvedValue({rows: []});
    const filter = {
      ...defaultFilter,
      sizeFilter: {Mini: true, Midi: false, Standard: false, Large: false},
    };

    await listPuzzles(filter, 50, 0);

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('mini');
  });

  it('skips size filter when all sizes selected', async () => {
    pool.query.mockResolvedValue({rows: []});

    await listPuzzles(defaultFilter, 50, 0);

    const sql = pool.query.mock.calls[0][0] as string;
    // When all selected, no size clause is added (just the base query)
    expect(sql).not.toContain('BETWEEN 9 AND 12');
  });

  it('userId parameter index accounts for search tokens and day filters', async () => {
    pool.query.mockResolvedValue({rows: []});
    const filter = {...defaultFilter, nameOrTitleFilter: 'test puzzle'};
    const userId = 'user-456';

    await listPuzzles(filter, 50, 0, userId);

    const params = pool.query.mock.calls[0][1] as any[];
    // userId should be the last parameter
    expect(params[params.length - 1]).toBe(userId);
  });
});

describe('getUserUploadedPuzzles', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('queries puzzles by uploaded_by user ID', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getUserUploadedPuzzles('user-789');

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('user-789');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('uploaded_by');
  });

  it('selects is_public column', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getUserUploadedPuzzles('user-789');

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('is_public');
  });

  it('maps is_public to boolean in results', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'p1',
          title: 'Puzzle',
          uploaded_at: '2024-01-01',
          times_solved: '5',
          is_public: true,
          rows: 5,
          cols: 5,
        },
        {
          pid: 'p2',
          title: 'Private',
          uploaded_at: '2024-01-02',
          times_solved: '0',
          is_public: false,
          rows: 7,
          cols: 7,
        },
        {
          pid: 'p3',
          title: null,
          uploaded_at: '2024-01-03',
          times_solved: '0',
          is_public: null,
          rows: 10,
          cols: 10,
        },
      ],
    });

    const result = await getUserUploadedPuzzles('user-789');

    expect(result[0].isPublic).toBe(true);
    expect(result[1].isPublic).toBe(false);
    expect(result[2].isPublic).toBe(false); // null coerces to false via !!
  });

  it('maps times_solved from string to number', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'p1',
          title: 'Test',
          uploaded_at: '2024-01-01',
          times_solved: '12',
          is_public: true,
          rows: 5,
          cols: 5,
        },
      ],
    });

    const result = await getUserUploadedPuzzles('user-789');

    expect(result[0].timesSolved).toBe(12);
  });

  it('formats size as rowsxcols', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'p1',
          title: 'Test',
          uploaded_at: '2024-01-01',
          times_solved: '0',
          is_public: true,
          rows: 15,
          cols: 15,
        },
      ],
    });

    const result = await getUserUploadedPuzzles('user-789');

    expect(result[0].size).toBe('15x15');
  });

  it('defaults title to Untitled when null', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'p1',
          title: null,
          uploaded_at: '2024-01-01',
          times_solved: '0',
          is_public: true,
          rows: 5,
          cols: 5,
        },
      ],
    });

    const result = await getUserUploadedPuzzles('user-789');

    expect(result[0].title).toBe('Untitled');
  });

  it('orders by uploaded_at DESC with limit 100', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getUserUploadedPuzzles('user-789');

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY uploaded_at DESC');
    expect(sql).toContain('LIMIT 100');
  });
});
