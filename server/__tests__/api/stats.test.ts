import {computePuzzleStats} from '../../api/stats';
import type {SolvedPuzzleType} from '../../model/puzzle_solve';

function makeSolve(overrides: Partial<SolvedPuzzleType> = {}): SolvedPuzzleType {
  return {
    pid: 'p1',
    gid: 'g1',
    title: 'Test Puzzle',
    size: '15x15',
    solved_time: new Date('2026-01-15'),
    time_taken_to_solve: 300,
    revealed_squares_count: 0,
    checked_squares_count: 0,
    ...overrides,
  };
}

describe('computePuzzleStats', () => {
  it('returns empty array for empty input', () => {
    expect(computePuzzleStats([])).toEqual([]);
  });

  it('groups puzzles by size correctly', () => {
    const solves = [
      makeSolve({size: '5x5', gid: 'g1'}),
      makeSolve({size: '15x15', gid: 'g2'}),
      makeSolve({size: '5x5', gid: 'g3'}),
    ];
    const stats = computePuzzleStats(solves);
    expect(stats).toHaveLength(2);
    const sizes = stats.map((s) => s.size);
    expect(sizes).toContain('5x5');
    expect(sizes).toContain('15x15');
  });

  it('computes correct n_puzzles_solved per size', () => {
    const solves = [
      makeSolve({size: '5x5', gid: 'g1'}),
      makeSolve({size: '5x5', gid: 'g2'}),
      makeSolve({size: '15x15', gid: 'g3'}),
    ];
    const stats = computePuzzleStats(solves);
    const mini = stats.find((s) => s.size === '5x5')!;
    const standard = stats.find((s) => s.size === '15x15')!;
    expect(mini.n_puzzles_solved).toBe(2);
    expect(standard.n_puzzles_solved).toBe(1);
  });

  it('computes correct avg_solve_time per size', () => {
    const solves = [
      makeSolve({size: '5x5', time_taken_to_solve: 100}),
      makeSolve({size: '5x5', time_taken_to_solve: 200}),
    ];
    const stats = computePuzzleStats(solves);
    expect(stats[0].avg_solve_time).toBe(150);
  });

  it('finds correct best_solve_time and best_solve_time_game', () => {
    const solves = [
      makeSolve({size: '15x15', gid: 'slow', time_taken_to_solve: 600}),
      makeSolve({size: '15x15', gid: 'fast', time_taken_to_solve: 120}),
      makeSolve({size: '15x15', gid: 'medium', time_taken_to_solve: 300}),
    ];
    const stats = computePuzzleStats(solves);
    expect(stats[0].best_solve_time).toBe(120);
    expect(stats[0].best_solve_time_game).toBe('fast');
  });

  it('computes avg_revealed_square_count rounded to 2 decimal places', () => {
    const solves = [
      makeSolve({size: '5x5', revealed_squares_count: 1}),
      makeSolve({size: '5x5', revealed_squares_count: 2}),
      makeSolve({size: '5x5', revealed_squares_count: 3}),
    ];
    const stats = computePuzzleStats(solves);
    // mean = 2, rounded to 2 decimals = 2
    expect(stats[0].avg_revealed_square_count).toBe(2);
  });

  it('computes avg_checked_square_count rounded to 2 decimal places', () => {
    const solves = [
      makeSolve({size: '5x5', checked_squares_count: 1}),
      makeSolve({size: '5x5', checked_squares_count: 2}),
    ];
    const stats = computePuzzleStats(solves);
    expect(stats[0].avg_checked_square_count).toBe(1.5);
  });

  it('results are sorted by size string alphabetically', () => {
    const solves = [makeSolve({size: '15x15'}), makeSolve({size: '5x5'}), makeSolve({size: '21x21'})];
    const stats = computePuzzleStats(solves);
    const sizes = stats.map((s) => s.size);
    expect(sizes).toEqual(['15x15', '21x21', '5x5']);
  });
});
