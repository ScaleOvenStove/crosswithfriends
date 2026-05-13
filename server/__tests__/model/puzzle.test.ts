import {pool, resetPoolMocks, mockClient} from '../../__mocks__/pool';

// Mock the pool module before importing the module under test
jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  listPuzzles,
  getUserUploadedPuzzles,
  getPuzzle,
  addPuzzle,
  recordSolve,
  getPuzzleInfo,
  getPuzzleStats,
  clearPuzzleListCache,
  clearPuzzleStatsCache,
} from '../../model/puzzle';

describe('listPuzzles', () => {
  beforeEach(() => {
    resetPoolMocks();
    clearPuzzleListCache();
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

    const sql = pool.query.mock.calls[0][0] as string;
    const params = pool.query.mock.calls[0][1] as any[];
    // userId should be at whatever position the SQL's "uploaded_by = $N" refers to.
    const match = sql.match(/uploaded_by = \$(\d+)/);
    expect(match).not.toBeNull();
    const userIdParamPos = Number.parseInt(match![1], 10);
    expect(params[userIdParamPos - 1]).toBe(userId);
  });

  it('orders by pid_numeric DESC by default', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles(defaultFilter, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY pid_numeric DESC');
    expect(sql).not.toContain('rating_weighted');
  });

  it('orders by weighted rating DESC when sortBy is rating_desc', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles({...defaultFilter, sortBy: 'rating_desc'}, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY rating_weighted DESC NULLS LAST, pid_numeric DESC');
  });

  it('orders by weighted rating ASC when sortBy is rating_asc', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles({...defaultFilter, sortBy: 'rating_asc'}, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY rating_weighted ASC NULLS LAST, pid_numeric DESC');
  });

  it('skips the rating filter clause when minRating is not set', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles(defaultFilter, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('rating_avg >=');
  });

  it('applies the rating filter when minRating is between 1 and 5', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles({...defaultFilter, minRating: 3}, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('rating_avg IS NOT NULL AND rating_avg >= 3');
  });

  it('ignores out-of-range minRating values', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles({...defaultFilter, minRating: 99}, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('rating_avg >=');
  });

  it('selects denormalized rating + solve-time columns directly (no LATERAL aggregates)', async () => {
    pool.query.mockResolvedValue({rows: []});
    await listPuzzles(defaultFilter, 50, 0);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('rating_avg');
    expect(sql).toContain('rating_count');
    expect(sql).toContain('median_solve_ms');
    expect(sql).toContain('solve_sample_count');
    // The previous implementation paid a per-row LATERAL cost; the whole
    // point of the denormalization is that the list query does no joins.
    expect(sql).not.toContain('PERCENTILE_CONT');
    expect(sql).not.toContain('FROM puzzle_ratings');
    expect(sql).not.toContain('FROM puzzle_solves');
  });

  it('maps median_solve_ms and solve_sample_count from row to camelCase fields', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'abc',
          uploaded_at: '2026-05-01',
          is_public: true,
          info: {title: 'Test', author: 'A'},
          grid_rows: 15,
          grid_cols: 15,
          contest: false,
          times_solved: '300',
          rating_avg: null,
          rating_count: 0,
          median_solve_ms: '780000',
          solve_sample_count: '87',
        },
      ],
    });

    const result = await listPuzzles(defaultFilter, 50, 0);

    expect(result[0].median_solve_ms).toBe(780000);
    expect(result[0].solve_sample_count).toBe(87);
    expect(typeof result[0].median_solve_ms).toBe('number');
    expect(typeof result[0].solve_sample_count).toBe('number');
  });

  it('returns null median when there are not enough samples', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          pid: 'abc',
          uploaded_at: '2026-05-01',
          is_public: true,
          info: {title: 'Test', author: 'A'},
          grid_rows: 15,
          grid_cols: 15,
          contest: false,
          times_solved: '5',
          rating_avg: null,
          rating_count: 0,
          median_solve_ms: null,
          solve_sample_count: '5',
        },
      ],
    });

    const result = await listPuzzles(defaultFilter, 50, 0);

    expect(result[0].median_solve_ms).toBeNull();
    expect(result[0].solve_sample_count).toBe(5);
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

describe('getPuzzle', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns content from the first row', async () => {
    const puzzleContent = {info: {title: 'Test'}, grid: [['A']], clues: {across: [], down: []}};
    pool.query.mockResolvedValueOnce({rows: [{content: puzzleContent}]});
    const result = await getPuzzle('p1');
    expect(result).toEqual(puzzleContent);
  });

  it('queries by pid parameter', async () => {
    pool.query.mockResolvedValueOnce({rows: [{content: {}}]});
    await getPuzzle('my-puzzle-id');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('my-puzzle-id');
  });
});

const validPuzzle = {
  grid: [
    ['A', 'B'],
    ['C', 'D'],
  ],
  info: {title: 'Test', author: 'Author', copyright: '', description: ''},
  clues: {across: ['clue1', 'clue2'], down: ['clue3', 'clue4']},
  circles: [],
  shades: [],
};

describe('addPuzzle', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('returns {pid, duplicate: false} for a new public puzzle', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []}) // no duplicate
      .mockResolvedValueOnce({rows: []});
    const result = await addPuzzle(validPuzzle as any, true, 'test-pid');
    expect(result).toEqual({pid: 'test-pid', duplicate: false});
  });

  it('returns {pid, duplicate: true} when content_hash already exists for public puzzle', async () => {
    pool.query.mockResolvedValueOnce({rows: [{pid: 'existing-pid'}]}); // duplicate found
    const result = await addPuzzle(validPuzzle as any, true, 'new-pid');
    expect(result).toEqual({pid: 'existing-pid', duplicate: true});
  });

  it('skips duplicate check for non-public puzzles', async () => {
    pool.query.mockResolvedValueOnce({rows: []}); // INSERT only, no dup check
    const result = await addPuzzle(validPuzzle as any, false, 'priv-pid');
    expect(result.duplicate).toBe(false);
    // Only 1 query (INSERT), not 2 (dup check + INSERT)
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('uses provided pid when given', async () => {
    pool.query.mockResolvedValue({rows: []});
    const result = await addPuzzle(validPuzzle as any, false, 'my-custom-pid');
    expect(result.pid).toBe('my-custom-pid');
  });

  it('throws on invalid puzzle (missing required fields)', async () => {
    const invalidPuzzle = {grid: 'not-an-array'};
    await expect(addPuzzle(invalidPuzzle as any)).rejects.toThrow();
  });

  it('accepts puzzle with data URI images', async () => {
    pool.query.mockResolvedValue({rows: []});
    const puzzleWithImages = {
      ...validPuzzle,
      images: {0: 'data:image/png;base64,abc123'},
    };
    await expect(addPuzzle(puzzleWithImages as any, false, 'img-pid')).resolves.not.toThrow();
  });

  it('rejects puzzle with external URL images', async () => {
    const puzzleWithBadImages = {
      ...validPuzzle,
      images: {0: 'https://evil.com/track.png'},
    };
    await expect(addPuzzle(puzzleWithBadImages as any, false, 'bad-pid')).rejects.toThrow(
      'Image values must be data: URIs'
    );
  });
});

describe('recordSolve', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('skips insert when user already solved this game', async () => {
    // isAlreadySolvedByUser returns count > 0
    pool.query.mockResolvedValueOnce({rows: [{count: 1}]});
    await recordSolve('p1', 'g1', 300, 'user-1');
    // Should only call the check query, not pool.connect
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('skips insert when anonymous and an anonymous solve already exists', async () => {
    // isGidAlreadySolved checks only anonymous solves (user_id IS NULL)
    pool.query.mockResolvedValueOnce({rows: [{count: 1}]});
    await recordSolve('p1', 'g1', 300);
    expect(pool.connect).not.toHaveBeenCalled();
    // Verify query checks only anonymous solves
    const dedupSql = pool.query.mock.calls[0][0] as string;
    expect(dedupSql).toContain('user_id IS NULL');
  });

  it('increments times_solved only for first solve of a game', async () => {
    // isAlreadySolvedByUser: not yet solved
    pool.query.mockResolvedValueOnce({rows: [{count: 0}]});
    // BEGIN
    mockClient.query.mockResolvedValueOnce({rows: []});
    // SELECT FOR UPDATE (lock)
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COUNT for first-solve check: 0 existing
    mockClient.query.mockResolvedValueOnce({rows: [{count: 0}]});
    // INSERT puzzle_solve (rowCount=1: row was inserted)
    mockClient.query.mockResolvedValueOnce({rows: [], rowCount: 1});
    // UPDATE times_solved
    mockClient.query.mockResolvedValueOnce({rows: []});
    // refreshPuzzleSolveStats: recompute median + sample count into puzzles
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COMMIT
    mockClient.query.mockResolvedValueOnce({rows: []});

    await recordSolve('p1', 'g1', 300, 'user-1');

    const allSql = mockClient.query.mock.calls.map((c: any[]) => c[0] as string);
    expect(allSql.some((s) => s.includes('times_solved = times_solved + 1'))).toBe(true);
    // The denorm refresh runs after the insert so the list query can read
    // median_solve_ms / solve_sample_count as plain columns.
    expect(allSql.some((s) => s.includes('PERCENTILE_CONT') && s.includes('UPDATE puzzles'))).toBe(true);
  });

  it('does not increment times_solved when game was already solved by someone else', async () => {
    // isAlreadySolvedByUser: not yet solved by this user
    pool.query.mockResolvedValueOnce({rows: [{count: 0}]});
    // BEGIN
    mockClient.query.mockResolvedValueOnce({rows: []});
    // SELECT FOR UPDATE
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COUNT: already 1 solve exists
    mockClient.query.mockResolvedValueOnce({rows: [{count: 1}]});
    // INSERT puzzle_solve (different user_id, no conflict)
    mockClient.query.mockResolvedValueOnce({rows: [], rowCount: 1});
    // refreshPuzzleSolveStats — still runs whenever a new row was inserted
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COMMIT (no UPDATE times_solved)
    mockClient.query.mockResolvedValueOnce({rows: []});

    await recordSolve('p1', 'g1', 300, 'user-2');

    const allSql = mockClient.query.mock.calls.map((c: any[]) => c[0] as string);
    expect(allSql.some((s) => s.includes('times_solved = times_solved + 1'))).toBe(false);
    // Stats refresh fires on every successful insert regardless of first-solve status.
    expect(allSql.some((s) => s.includes('PERCENTILE_CONT'))).toBe(true);
  });

  it('does not increment times_solved when concurrent insert hit the unique index (ON CONFLICT)', async () => {
    // Pre-flight check: not yet solved (race: the racing request committed after this check)
    pool.query.mockResolvedValueOnce({rows: [{count: 0}]});
    // BEGIN
    mockClient.query.mockResolvedValueOnce({rows: []});
    // SELECT FOR UPDATE — racing request has committed by the time we acquire the lock
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COUNT inside the locked txn: 1 (the racing request's row)
    mockClient.query.mockResolvedValueOnce({rows: [{count: 1}]});
    // INSERT with ON CONFLICT DO NOTHING — no row inserted (rowCount=0)
    mockClient.query.mockResolvedValueOnce({rows: [], rowCount: 0});
    // COMMIT — no UPDATE times_solved, no refresh (insert was a no-op)
    mockClient.query.mockResolvedValueOnce({rows: []});

    await expect(recordSolve('p1', 'g1', 300)).resolves.not.toThrow();

    const allSql = mockClient.query.mock.calls.map((c: any[]) => c[0] as string);
    expect(allSql.some((s) => s.includes('times_solved'))).toBe(false);
    // No insert means no stats change; skip the refresh.
    expect(allSql.some((s) => s.includes('PERCENTILE_CONT'))).toBe(false);
    // Verify the INSERT uses ON CONFLICT DO NOTHING
    expect(allSql[3]).toContain('ON CONFLICT DO NOTHING');
  });

  it('allows anonymous solve even when an authenticated solve exists for the same game', async () => {
    // isGidAlreadySolved: only checks anonymous solves, should return count=0
    // even though an authenticated solve exists for this gid
    pool.query.mockResolvedValueOnce({rows: [{count: 0}]});
    // BEGIN
    mockClient.query.mockResolvedValueOnce({rows: []});
    // SELECT FOR UPDATE
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COUNT for first-solve check: 1 (authenticated user already solved)
    mockClient.query.mockResolvedValueOnce({rows: [{count: 1}]});
    // INSERT puzzle_solve (anonymous)
    mockClient.query.mockResolvedValueOnce({rows: [], rowCount: 1});
    // refreshPuzzleSolveStats
    mockClient.query.mockResolvedValueOnce({rows: []});
    // COMMIT
    mockClient.query.mockResolvedValueOnce({rows: []});

    await recordSolve('p1', 'g1', 300); // no userId = anonymous

    // Should have proceeded to insert (pool.connect was called)
    expect(pool.connect).toHaveBeenCalled();
    // Verify the dedup query checked only anonymous solves
    const dedupSql = pool.query.mock.calls[0][0] as string;
    expect(dedupSql).toContain('user_id IS NULL');
  });

  it('rolls back, releases the client, and rethrows on error', async () => {
    pool.query.mockResolvedValueOnce({rows: [{count: 0}]});
    mockClient.query
      .mockResolvedValueOnce({rows: []}) // BEGIN
      .mockRejectedValueOnce(new Error('db error')); // SELECT FOR UPDATE fails
    mockClient.query.mockResolvedValueOnce({rows: []}); // ROLLBACK

    await expect(recordSolve('p1', 'g1', 300, 'user-1')).rejects.toThrow('db error');

    const rollbackCall = mockClient.query.mock.calls.find((c: any[]) => c[0] === 'ROLLBACK');
    expect(rollbackCall).toBeDefined();
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('getPuzzleInfo', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns puzzle.info from getPuzzle result', async () => {
    const info = {title: 'My Puzzle', author: 'Author', copyright: '', description: ''};
    pool.query.mockResolvedValueOnce({rows: [{content: {info, grid: [], clues: {across: [], down: []}}}]});
    const result = await getPuzzleInfo('p1');
    expect(result).toEqual(info);
  });
});

describe('getPuzzleStats', () => {
  beforeEach(() => {
    resetPoolMocks();
    clearPuzzleStatsCache();
  });

  it('returns the median and sample count when the threshold is met', async () => {
    pool.query.mockResolvedValueOnce({rows: [{solve_sample_count: 42, median_solve_ms: 1122334}]});
    const result = await getPuzzleStats('p1');
    expect(result).toEqual({sampleCount: 42, medianMs: 1122334});
  });

  it('returns null median when below the sample threshold', async () => {
    pool.query.mockResolvedValueOnce({rows: [{solve_sample_count: 7, median_solve_ms: null}]});
    const result = await getPuzzleStats('p2');
    expect(result).toEqual({sampleCount: 7, medianMs: null});
  });

  it('handles an empty result row (no solves at all)', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await getPuzzleStats('p3');
    expect(result).toEqual({sampleCount: 0, medianMs: null});
  });

  it('reads denormalized columns from puzzles instead of aggregating puzzle_solves', async () => {
    pool.query.mockResolvedValueOnce({rows: [{solve_sample_count: 0, median_solve_ms: null}]});
    await getPuzzleStats('p4');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('FROM puzzles');
    expect(sql).toContain('median_solve_ms');
    expect(sql).toContain('solve_sample_count');
    // The aggregation happens in refreshPuzzleSolveStats on the write path;
    // the read path must not pay that cost per request.
    expect(sql).not.toContain('PERCENTILE_CONT');
    expect(sql).not.toContain('FROM puzzle_solves');
    expect(params).toEqual(['p4']);
  });

  it('caches repeat lookups for the same pid', async () => {
    pool.query.mockResolvedValueOnce({rows: [{solve_sample_count: 30, median_solve_ms: 100000}]});
    await getPuzzleStats('p5');
    await getPuzzleStats('p5');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache for a pid when a new solve is recorded', async () => {
    // Prime: cache pid="p6" stats
    pool.query.mockResolvedValueOnce({rows: [{solve_sample_count: 30, median_solve_ms: 100000}]});
    await getPuzzleStats('p6');
    expect(pool.query).toHaveBeenCalledTimes(1);

    // recordSolve flow: isAlreadySolvedByUser=0, then txn writes
    pool.query.mockResolvedValueOnce({rows: [{count: 0}]});
    mockClient.query
      .mockResolvedValueOnce({rows: []}) // BEGIN
      .mockResolvedValueOnce({rows: []}) // SELECT FOR UPDATE
      .mockResolvedValueOnce({rows: [{count: 0}]}) // first-solve COUNT
      .mockResolvedValueOnce({rows: [], rowCount: 1}) // INSERT
      .mockResolvedValueOnce({rows: []}) // UPDATE times_solved
      .mockResolvedValueOnce({rows: []}) // refreshPuzzleSolveStats
      .mockResolvedValueOnce({rows: []}); // COMMIT
    await recordSolve('p6', 'g6', 300, 'user-6');

    // Cache should have been invalidated; the next stats call hits the DB again.
    pool.query.mockResolvedValueOnce({rows: [{solve_sample_count: 31, median_solve_ms: 99000}]});
    const fresh = await getPuzzleStats('p6');
    expect(fresh).toEqual({sampleCount: 31, medianMs: 99000});
  });
});
