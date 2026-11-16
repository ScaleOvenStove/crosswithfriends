/* eslint no-underscore-dangle: "off" */
import {vi} from 'vitest';
import GridControls from '../GridControls';
import {makeGrid, makeControlsInstance} from '../testHelpers';

describe('GridControls._handleKeyDown — letter input', () => {
  it('calls updateGrid with uppercase letter', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    vi.useFakeTimers();
    instance._handleKeyDown('a', false, false);
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'A');
    vi.useRealTimers();
  });

  it('does not call updateGrid when frozen', () => {
    const {instance, props} = makeControlsInstance(GridControls, {frozen: true});
    instance._handleKeyDown('a', false, false);
    expect(props.updateGrid).not.toHaveBeenCalled();
  });

  it('rejects non-letter, non-action characters', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('€', false, false);
    instance._handleKeyDown('§', false, false);
    expect(props.updateGrid).not.toHaveBeenCalled();
  });

  it('accepts accented letters (AltGr / dead keys), uppercased', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    vi.useFakeTimers();
    instance._handleKeyDown('é', false, false, 'KeyE');
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'É');
    vi.useRealTimers();
  });

  it('appends a letter outside the BMP to a rebus without splitting earlier ones', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: '𠮷'.repeat(11)}}),
    });
    vi.useFakeTimers();
    instance._handleKeyDown('A', true, false, 'KeyA');
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, `${'𠮷'.repeat(10)}A`);
    vi.useRealTimers();
  });

  it('ignores a dead key press itself', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('Dead', false, false, 'Quote');
    expect(props.updateGrid).not.toHaveBeenCalled();
  });

  it('accepts digit keys', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    vi.useFakeTimers();
    instance._handleKeyDown('5', false, false);
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '5');
    vi.useRealTimers();
  });
});

describe('GridControls._handleKeyDown — action keys', () => {
  it('handles Backspace', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}}),
    });
    instance._handleKeyDown('Backspace', false, false);
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '');
  });

  it('handles Delete', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}}),
    });
    instance._handleKeyDown('Delete', false, false);
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '');
  });

  it('handles ArrowRight navigation', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('ArrowRight', false, false);
    expect(props.onSetSelected).toHaveBeenCalledWith({r: 0, c: 1});
  });

  it('handles space to flip direction', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown(' ', false, false);
    expect(props.onSetDirection).toHaveBeenCalledWith('down');
  });

  it('handles period', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('.', false, false);
    expect(props.onPressPeriod).toHaveBeenCalled();
  });

  it('handles Enter', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('Enter', false, false);
    expect(props.onPressEnter).toHaveBeenCalled();
  });

  it('handles Tab without throwing', () => {
    const {instance} = makeControlsInstance(GridControls);
    expect(() => instance._handleKeyDown('Tab', false, false)).not.toThrow();
  });
});

describe('GridControls._handleKeyDown — alt key shortcuts', () => {
  it('calls onCheck("square") for Alt+S on Mac (ev.key="ß", ev.code="KeyS")', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('ß', false, true, 'KeyS');
    expect(props.onCheck).toHaveBeenCalledWith('square');
  });

  it('calls onCheck("word") for Alt+W on Mac (ev.key="∑", ev.code="KeyW")', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('∑', false, true, 'KeyW');
    expect(props.onCheck).toHaveBeenCalledWith('word');
  });

  it('calls onCheck("puzzle") for Alt+P on Mac (ev.key="π", ev.code="KeyP")', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('π', false, true, 'KeyP');
    expect(props.onCheck).toHaveBeenCalledWith('puzzle');
  });

  it('calls onReveal("square") for Alt+Shift+S on Mac', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('ß', true, true, 'KeyS');
    expect(props.onReveal).toHaveBeenCalledWith('square');
  });

  it('calls onReveal("word") for Alt+Shift+W on Mac', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('∑', true, true, 'KeyW');
    expect(props.onReveal).toHaveBeenCalledWith('word');
  });

  it('calls onReveal("puzzle") for Alt+Shift+P on Mac', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('π', true, true, 'KeyP');
    expect(props.onReveal).toHaveBeenCalledWith('puzzle');
  });

  it('works with Latin ev.key values on Windows/Linux', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('s', false, true, 'KeyS');
    expect(props.onCheck).toHaveBeenCalledWith('square');
  });

  it('claims Alt+S so the browser does not also act on it', () => {
    const {instance} = makeControlsInstance(GridControls);
    expect(instance._handleKeyDown('s', false, true, 'KeyS')).toBe(true);
  });

  it('leaves other Alt combos (Alt+D) to the browser without typing', () => {
    vi.useFakeTimers();
    const {instance, props} = makeControlsInstance(GridControls);
    expect(instance._handleKeyDown('d', false, true, 'KeyD')).toBeUndefined();
    vi.runAllTimers();
    expect(props.updateGrid).not.toHaveBeenCalled();
    expect(props.onCheck).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('leaves Alt+ArrowLeft (browser back) alone instead of moving the cursor', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    expect(instance._handleKeyDown('ArrowLeft', false, true, 'ArrowLeft')).toBeUndefined();
    expect(props.onSetSelected).not.toHaveBeenCalled();
  });

  it('leaves Alt+S to the browser in contest mode, where check is disabled', () => {
    const {instance, props} = makeControlsInstance(GridControls, {contest: true});
    expect(instance._handleKeyDown('s', false, true, 'KeyS')).toBeUndefined();
    expect(props.onCheck).not.toHaveBeenCalled();
  });

  it('applies the same rules in vim mode', () => {
    const {instance, props} = makeControlsInstance(GridControls, {vimMode: true});
    expect(instance._handleKeyDownVim('d', false, true, 'KeyD')).toBeUndefined();
    expect(instance._handleKeyDownVim('ArrowLeft', false, true, 'ArrowLeft')).toBeUndefined();
    expect(props.onSetSelected).not.toHaveBeenCalled();
    expect(instance._handleKeyDownVim('w', false, true, 'KeyW')).toBe(true);
    expect(props.onCheck).toHaveBeenCalledWith('word');
  });
});

describe('GridControls.delete', () => {
  it('clears a filled cell and returns true', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}}),
    });
    expect(instance.delete()).toBe(true);
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '');
  });

  it('does not clear a verified ("good") cell', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A', good: true}}),
    });
    expect(instance.delete()).toBe(false);
    expect(props.updateGrid).not.toHaveBeenCalled();
  });

  it('returns false on empty cell', () => {
    const {instance} = makeControlsInstance(GridControls);
    expect(instance.delete()).toBe(false);
  });
});

// Grid layout (3x3, black at 1,1):
//   (0,0) (0,1) (0,2)   ← 1-Across (3 cells)
//   (1,0)   .   (1,2)
//   (2,0) (2,1) (2,2)
describe('GridControls.goToNextEmptyCell — auto-advance', () => {
  it('auto-advances when filling the last empty cell mid-word', () => {
    // Row 0: A _ C — cursor on empty middle cell (0,1), the only gap
    const {instance} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}, '0,2': {value: 'C'}}),
      selected: {r: 0, c: 1},
      direction: 'across',
      autoAdvanceCursor: true,
    });
    const spy = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    instance.goToNextEmptyCell({nextClueIfFilled: true});
    expect(spy).toHaveBeenCalled();
  });

  it('does NOT auto-advance when overwriting a letter in an already-complete word', () => {
    // Row 0: A B C — all filled, cursor on last cell (0,2)
    const {instance} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}, '0,1': {value: 'B'}, '0,2': {value: 'C'}}),
      selected: {r: 0, c: 2},
      direction: 'across',
      autoAdvanceCursor: true,
    });
    const spy = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    instance.goToNextEmptyCell({nextClueIfFilled: true});
    expect(spy).not.toHaveBeenCalled();
  });

  it('auto-advances when filling the last empty cell at end of word', () => {
    // Row 0: A B _ — cursor on empty last cell (0,2)
    const {instance} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}, '0,1': {value: 'B'}}),
      selected: {r: 0, c: 2},
      direction: 'across',
      autoAdvanceCursor: true,
    });
    const spy = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    instance.goToNextEmptyCell({nextClueIfFilled: true});
    expect(spy).toHaveBeenCalled();
  });

  it('does not auto-advance when other empty cells remain', () => {
    // Row 0: _ _ C — cursor at (0,0), still an empty cell at (0,1)
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,2': {value: 'C'}}),
      selected: {r: 0, c: 0},
      direction: 'across',
      autoAdvanceCursor: true,
    });
    const spy = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    instance.goToNextEmptyCell({nextClueIfFilled: true});
    expect(spy).not.toHaveBeenCalled();
    expect(props.onSetSelected).toHaveBeenCalledWith({r: 0, c: 1});
  });

  it('does not auto-advance when overwriting a mid-word letter in a complete word', () => {
    // Row 0: A B C — all filled, cursor on middle cell (0,1)
    const {instance} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}, '0,1': {value: 'B'}, '0,2': {value: 'C'}}),
      selected: {r: 0, c: 1},
      direction: 'across',
      autoAdvanceCursor: true,
    });
    const spy = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    instance.goToNextEmptyCell({nextClueIfFilled: true});
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not auto-advance when nextClueIfFilled is false', () => {
    // Row 0: A _ C — last empty cell, but auto-advance disabled
    const {instance} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A'}, '0,2': {value: 'C'}}),
      selected: {r: 0, c: 1},
      direction: 'across',
      autoAdvanceCursor: false,
    });
    const spy = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    instance.goToNextEmptyCell({nextClueIfFilled: false});
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('GridControls.backspace', () => {
  it('deletes current cell if filled', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,1': {value: 'B'}}),
      selected: {r: 0, c: 1},
    });
    instance.backspace();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 1, '');
  });

  it('moves to previous cell and clears it when current is empty', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      selected: {r: 0, c: 1},
      direction: 'across',
    });
    instance.backspace();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '');
  });

  it('stays put when shouldStay is true and current is empty', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      selected: {r: 0, c: 1},
    });
    instance.backspace(true);
    expect(props.onSetSelected).not.toHaveBeenCalled();
  });
});

describe('GridControls._handleKeyDown — rebus mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('Escape toggles rebus mode on and off', () => {
    const {instance} = makeControlsInstance(GridControls);
    instance._handleKeyDown('Escape', false, false);
    expect(instance.state.rebusMode).toBe(true);
    instance._handleKeyDown('Escape', false, false);
    expect(instance.state.rebusMode).toBe(false);
  });

  it('Insert also enters rebus mode', () => {
    const {instance} = makeControlsInstance(GridControls);
    instance._handleKeyDown('Insert', false, false);
    expect(instance.state.rebusMode).toBe(true);
  });

  it('appends unshifted digits to the cell without advancing', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: '1'}}),
    });
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('2', false, false);
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '12');
    expect(props.onSetSelected).not.toHaveBeenCalled();
  });

  it('Enter commits the rebus and advances to the next cell', () => {
    const {instance, props} = makeControlsInstance(GridControls, {grid: makeGrid({'0,0': {value: '12'}})});
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('Enter', false, false);
    expect(instance.state.rebusMode).toBe(false);
    expect(props.onPressEnter).not.toHaveBeenCalled();
    expect(props.onSetSelected).toHaveBeenCalledWith({r: 0, c: 1});
  });

  it('Backspace removes one character instead of clearing the cell', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: '123'}}),
    });
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('Backspace', false, false);
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '12');
    expect(instance.state.rebusMode).toBe(true);
  });

  it('Backspace removes a whole letter outside the BMP, not half of it', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'A𠮷'}}),
    });
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('Backspace', false, false);
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'A');
  });

  it('moves to the next clue when the rebus filled the last empty square of the word', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      autoAdvanceCursor: true,
      grid: makeGrid({'0,1': {value: 'B'}, '0,2': {value: 'C'}}),
    });
    const selectNextClue = vi.spyOn(instance, 'selectNextClue');
    instance._handleKeyDown('Escape', false, false);
    // The rebus has been written by the time Enter commits it.
    instance.props = {
      ...props,
      grid: makeGrid({'0,0': {value: '12'}, '0,1': {value: 'B'}, '0,2': {value: 'C'}}),
    };
    instance._handleKeyDown('Enter', false, false);
    expect(selectNextClue).toHaveBeenCalled();
  });

  it('waits for queued characters before advancing on Enter', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    props.updateGrid.mockImplementation((r, c, value) => {
      props.grid[r][c].value = value;
    });
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('1', false, false);
    instance._handleKeyDown('2', false, false);
    instance._handleKeyDown('Enter', false, false);
    expect(props.onSetSelected).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledTimes(2);
    expect(props.updateGrid.mock.calls.every(([r, c]) => r === 0 && c === 0)).toBe(true);
    expect(props.onSetSelected).toHaveBeenCalledWith({r: 0, c: 1});
    expect(props.updateGrid.mock.invocationCallOrder[1]).toBeLessThan(
      props.onSetSelected.mock.invocationCallOrder[0]
    );
  });

  it('keeps queued characters on the rebus cell when the selection moves first', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('1', false, false);
    instance._handleKeyDown('2', false, false);
    // Clicking another square changes the selection before the queue drains.
    instance.props = {...props, selected: {r: 2, c: 2}};
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map(([r, c]) => [r, c])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('applies a queued Backspace to the rebus cell when the selection moves first', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      grid: makeGrid({'0,0': {value: 'X'}, '2,2': {value: 'Z'}}),
    });
    props.updateGrid.mockImplementation((r, c, value) => {
      props.grid[r][c].value = value;
    });
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('1', false, false);
    instance._handleKeyDown('Backspace', false, false);
    instance.props = {...props, selected: {r: 2, c: 2}};
    vi.runAllTimers();
    expect(props.grid[0][0].value).toBe('X');
    expect(props.grid[2][2].value).toBe('Z');
  });

  it('stays on the square when a rebus is closed with nothing typed', () => {
    const {instance, props} = makeControlsInstance(GridControls, {
      autoAdvanceCursor: true,
      grid: makeGrid({'0,1': {value: 'B'}, '0,2': {value: 'C'}}),
    });
    const selectNextClue = vi.spyOn(instance, 'selectNextClue');
    instance._handleKeyDown('Escape', false, false);
    instance._handleKeyDown('Enter', false, false);
    expect(selectNextClue).not.toHaveBeenCalled();
    expect(props.onSetSelected).not.toHaveBeenCalled();
  });

  it('does not enter rebus mode when frozen', () => {
    const {instance} = makeControlsInstance(GridControls, {frozen: true});
    instance._handleKeyDown('Escape', false, false);
    expect(instance.state.rebusMode).toBe(false);
  });

  it('leaves rebus mode when the selection moves', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('Escape', false, false);
    const prevProps = props;
    instance.props = {...props, selected: {r: 0, c: 2}};
    instance.componentDidUpdate(prevProps);
    expect(instance.state.rebusMode).toBe(false);
  });
});

describe('GridControls — input method editors', () => {
  const keyDown = (overrides) => ({
    key: 'Process',
    keyCode: 229,
    shiftKey: false,
    altKey: false,
    nativeEvent: {isComposing: false},
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  });
  const inputEvent = (value, isComposing = false) => {
    const target = {value};
    return {target, nativeEvent: {isComposing}};
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('leaves a "Process" keydown to the IME and types the letter from the input event', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    const ev = keyDown();
    instance.handleKeyDown(ev);
    expect(ev.preventDefault).not.toHaveBeenCalled();
    const input = inputEvent('f');
    instance.handleInput(input);
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'F');
    expect(input.target.value).toBe('');
  });

  it('treats keyCode 229 as an IME keydown even without key "Process"', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance.handleKeyDown(keyDown({key: 'Unidentified'}));
    instance.handleInput(inputEvent('q'));
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'Q');
  });

  it('relays space from an IME to the grid action', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance.handleKeyDown(keyDown());
    instance.handleInput(inputEvent(' '));
    expect(props.onSetDirection).toHaveBeenCalledWith('down');
  });

  it('waits for compositionend before typing composed text', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance.handleKeyDown(keyDown({nativeEvent: {isComposing: true}}));
    instance.handleCompositionStart();
    const mid = inputEvent('k', true);
    instance.handleInput(mid);
    vi.runAllTimers();
    expect(props.updateGrid).not.toHaveBeenCalled();
    expect(mid.target.value).toBe('k');

    instance.handleCompositionEnd({target: mid.target});
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'K');
    expect(mid.target.value).toBe('');
    // Firefox's trailing input event finds the box already drained.
    instance.handleInput({target: mid.target, nativeEvent: {isComposing: false}});
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledTimes(1);
  });

  it('discards text from keys the grid ignored without typing it', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance.handleKeyDown(keyDown({key: "'", keyCode: 222}));
    const input = inputEvent("'");
    instance.handleInput(input);
    vi.runAllTimers();
    expect(props.updateGrid).not.toHaveBeenCalled();
    expect(input.target.value).toBe('');
  });

  it('does not re-run a vim normal-mode command when its character lands in the input', () => {
    const {instance, props} = makeControlsInstance(GridControls, {vimMode: true});
    instance.handleKeyDown(keyDown({key: 'l', keyCode: 76}));
    expect(props.onSetSelected).toHaveBeenCalledTimes(1);
    instance.handleInput(inputEvent('l'));
    expect(props.onSetSelected).toHaveBeenCalledTimes(1);
  });

  it('routes IME input through the vim handler in vim mode', () => {
    const {instance, props} = makeControlsInstance(GridControls, {vimMode: true});
    instance.handleKeyDown(keyDown());
    instance.handleInput(inputEvent('l'));
    expect(props.onSetSelected).toHaveBeenCalledWith({r: 0, c: 1});
  });
});
