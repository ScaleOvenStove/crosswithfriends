import {describe, expect, it, vi} from 'vitest';
import {copyPuzzleId} from '../puzzleId';

describe('copyPuzzleId', () => {
  it('writes the puzzle ID to the clipboard', () => {
    const clipboard = {writeText: vi.fn()};

    expect(copyPuzzleId('101663489-plig', clipboard)).toBe(true);

    expect(clipboard.writeText).toHaveBeenCalledWith('101663489-plig');
  });

  it('does nothing when the puzzle ID is missing', () => {
    const clipboard = {writeText: vi.fn()};

    expect(copyPuzzleId('', clipboard)).toBe(false);

    expect(clipboard.writeText).not.toHaveBeenCalled();
  });
});
