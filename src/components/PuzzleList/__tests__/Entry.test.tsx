import Entry, {EntryProps} from '../Entry';

// Mock react-router-dom Link to avoid router context requirement
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    Link: ({children, to, ...rest}: any) => React.createElement('a', {href: to, ...rest}, children),
  };
});

function makeEntry(overrides: Partial<EntryProps> = {}): Entry {
  const defaultProps: EntryProps = {
    info: {type: 'Daily Puzzle'},
    title: 'Test Puzzle',
    author: 'Author',
    pid: 'test-pid',
    status: undefined,
    stats: {},
    ...overrides,
  };
  return new Entry(defaultProps);
}

describe('Entry size classification', () => {
  describe('title-based classification', () => {
    it('returns Mini when title contains "mini"', () => {
      const entry = makeEntry({title: 'NY Times Mini Crossword'});
      expect(entry.size).toBe('Mini');
    });

    it('returns Midi when title contains "midi"', () => {
      const entry = makeEntry({title: 'Monday Midi Puzzle'});
      expect(entry.size).toBe('Midi');
    });

    it('is case-insensitive for mini', () => {
      const entry = makeEntry({title: 'DAILY MINI PUZZLE'});
      expect(entry.size).toBe('Mini');
    });

    it('is case-insensitive for midi', () => {
      const entry = makeEntry({title: 'FRIDAY MIDI'});
      expect(entry.size).toBe('Midi');
    });

    it('midi takes priority over mini when both are in title', () => {
      const entry = makeEntry({title: 'Mini Midi Mix'});
      expect(entry.size).toBe('Midi');
    });

    it('does not match mini inside other words', () => {
      // \bmini\b requires word boundary — "Minimalist" should NOT match
      const grid = Array.from({length: 5}, () => Array(5).fill(''));
      const entry = makeEntry({title: 'Minimalist Puzzle', grid});
      // Falls through to grid-based: 5x5 = Mini (from grid, not title match)
      expect(entry.size).toBe('Mini');
    });

    it('title classification takes priority over grid size', () => {
      // Title says "mini" but grid is 15x15 (would be Standard by grid)
      const grid = Array.from({length: 15}, () => Array(15).fill(''));
      const entry = makeEntry({title: 'Mini Crossword', grid});
      expect(entry.size).toBe('Mini');
    });
  });

  describe('grid-based classification', () => {
    it('returns Mini for grid <= 8', () => {
      const grid = Array.from({length: 5}, () => Array(5).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Mini');
    });

    it('returns Mini for 8x8 grid', () => {
      const grid = Array.from({length: 8}, () => Array(8).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Mini');
    });

    it('returns Midi for 9x9 grid', () => {
      const grid = Array.from({length: 9}, () => Array(9).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Midi');
    });

    it('returns Midi for 12x12 grid', () => {
      const grid = Array.from({length: 12}, () => Array(12).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Midi');
    });

    it('returns Standard for 13x13 grid', () => {
      const grid = Array.from({length: 13}, () => Array(13).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Standard');
    });

    it('returns Standard for 15x15 grid', () => {
      const grid = Array.from({length: 15}, () => Array(15).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Standard');
    });

    it('returns Standard for 16x16 grid', () => {
      const grid = Array.from({length: 16}, () => Array(16).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Standard');
    });

    it('returns Large for 17x17 grid', () => {
      const grid = Array.from({length: 17}, () => Array(17).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Large');
    });

    it('returns Large for 21x21 grid', () => {
      const grid = Array.from({length: 21}, () => Array(21).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Large');
    });

    it('uses max dimension for non-square grids', () => {
      // 5 rows x 12 cols — max is 12, which is Midi
      const grid = Array.from({length: 5}, () => Array(12).fill(''));
      const entry = makeEntry({title: 'Untitled', grid});
      expect(entry.size).toBe('Midi');
    });
  });

  describe('type-based fallback', () => {
    it('returns Standard for Daily Puzzle type when no grid', () => {
      const entry = makeEntry({title: 'Untitled', info: {type: 'Daily Puzzle'}});
      expect(entry.size).toBe('Standard');
    });

    it('returns Mini for Mini Puzzle type when no grid', () => {
      const entry = makeEntry({title: 'Untitled', info: {type: 'Mini Puzzle'}});
      expect(entry.size).toBe('Mini');
    });

    it('returns Puzzle for unknown type when no grid', () => {
      const entry = makeEntry({title: 'Untitled', info: {type: 'Custom'}});
      expect(entry.size).toBe('Puzzle');
    });
  });
});

describe('Entry display', () => {
  it('formats displayName as author | size', () => {
    const entry = makeEntry({
      author: 'John Doe',
      title: 'Untitled',
      info: {type: 'Daily Puzzle'},
    });
    const displayName = [entry.props.author.trim(), entry.size].filter(Boolean).join(' | ');
    expect(displayName).toBe('John Doe | Standard');
  });

  it('handles empty author gracefully', () => {
    const entry = makeEntry({
      author: '',
      title: 'Untitled',
      info: {type: 'Mini Puzzle'},
    });
    const displayName = [entry.props.author.trim(), entry.size].filter(Boolean).join(' | ');
    expect(displayName).toBe('Mini');
  });

  it('computes correct solve count from stats', () => {
    const entry = makeEntry({
      stats: {numSolves: 10, solves: [{}, {}, {}]},
    });
    const numSolvesOld = (entry.props.stats.solves || []).length;
    const numSolves = numSolvesOld + (entry.props.stats.numSolves || 0);
    expect(numSolves).toBe(13);
  });

  it('handles missing stats gracefully', () => {
    const entry = makeEntry({stats: {}});
    const numSolvesOld = (entry.props.stats.solves || []).length;
    const numSolves = numSolvesOld + (entry.props.stats.numSolves || 0);
    expect(numSolves).toBe(0);
  });
});
