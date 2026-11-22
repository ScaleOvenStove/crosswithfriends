import {describe, expect, it, vi} from 'vitest';
import {copyPuzzleId, copyText} from '../puzzleId';

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

describe('copyText', () => {
  it('writes the text and resolves true', async () => {
    const clipboard = {writeText: vi.fn().mockResolvedValue(undefined)};

    expect(await copyText('https://example.com/beta/game/1', clipboard)).toBe(true);

    expect(clipboard.writeText).toHaveBeenCalledWith('https://example.com/beta/game/1');
  });

  // Safari rejects with NotAllowedError outside a fresh user gesture; this
  // must not escape as an unhandled rejection.
  it('resolves false when the browser denies the write', async () => {
    const denied = Object.assign(new Error('The request is not allowed'), {name: 'NotAllowedError'});
    const clipboard = {writeText: vi.fn().mockRejectedValue(denied)};

    expect(await copyText('x', clipboard)).toBe(false);
  });

  it('resolves false when the Clipboard API is unavailable', async () => {
    expect(await copyText('x', null)).toBe(false);
  });
});
