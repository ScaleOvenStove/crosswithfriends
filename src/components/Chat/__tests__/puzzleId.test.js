import {describe, expect, it, vi} from 'vitest';
import {copyPuzzleId} from '../puzzleId';

describe('copyPuzzleId', () => {
  it('writes the puzzle ID to the clipboard', async () => {
    const clipboard = {writeText: vi.fn().mockResolvedValue(undefined)};

    expect(await copyPuzzleId('101663489-plig', clipboard)).toBe(true);

    expect(clipboard.writeText).toHaveBeenCalledWith('101663489-plig');
  });

  it('does nothing when the puzzle ID is missing', async () => {
    const clipboard = {writeText: vi.fn().mockResolvedValue(undefined)};

    expect(await copyPuzzleId('', clipboard)).toBe(false);

    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('returns false when clipboard write fails', async () => {
    const clipboard = {writeText: vi.fn().mockRejectedValue(new Error('denied'))};

    expect(await copyPuzzleId('101663489-plig', clipboard)).toBe(false);
  });
});
