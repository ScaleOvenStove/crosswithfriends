import {getPuzzleSizeLabel} from '../puzzleSize';

const square = (n: number) => Array.from({length: n}, () => Array(n).fill(''));
const rect = (rows: number, cols: number) => Array.from({length: rows}, () => Array(cols).fill(''));

describe('getPuzzleSizeLabel', () => {
  it('prefers a "midi" title over a small grid and the upload-time type', () => {
    // Puzzmo Midis are 5x5–7x7; upload stamps them 'Mini Puzzle' (≤10 rows).
    expect(getPuzzleSizeLabel('Puzzmo Midi (Mon., Oct 5, 2026): Media Diet', rect(4, 7), 'Mini Puzzle')).toBe(
      'Midi'
    );
    expect(getPuzzleSizeLabel('Midi, August 25', square(5), 'Mini Puzzle')).toBe('Midi');
  });

  it('classifies by the larger grid dimension', () => {
    expect(getPuzzleSizeLabel('Untitled', rect(4, 9))).toBe('Midi');
    expect(getPuzzleSizeLabel('Untitled', square(8))).toBe('Mini');
    expect(getPuzzleSizeLabel('Untitled', square(12))).toBe('Midi');
    expect(getPuzzleSizeLabel('Untitled', square(15), 'Daily Puzzle')).toBe('Standard');
    expect(getPuzzleSizeLabel('Untitled', square(21))).toBe('Large');
  });

  it('ignores mini/midi inside other words', () => {
    expect(getPuzzleSizeLabel('Minimalist Midian', square(15))).toBe('Standard');
  });

  it('falls back to the type field without a grid', () => {
    expect(getPuzzleSizeLabel('Untitled', undefined, 'Daily Puzzle')).toBe('Standard');
    expect(getPuzzleSizeLabel('Untitled', undefined, 'Mini Puzzle')).toBe('Mini');
    expect(getPuzzleSizeLabel('Untitled', undefined)).toBe('Puzzle');
    expect(getPuzzleSizeLabel('Untitled', [])).toBe('Puzzle');
  });
});
