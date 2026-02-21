/* eslint no-underscore-dangle: "off" */
import GridControls from '../GridControls';
import {makeGrid, makeControlsInstance} from '../testHelpers';

describe('GridControls._handleKeyDown — letter input', () => {
  it('calls updateGrid with uppercase letter', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    jest.useFakeTimers();
    instance._handleKeyDown('a', false, false);
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'A');
    jest.useRealTimers();
  });

  it('does not call updateGrid when frozen', () => {
    const {instance, props} = makeControlsInstance(GridControls, {frozen: true});
    instance._handleKeyDown('a', false, false);
    expect(props.updateGrid).not.toHaveBeenCalled();
  });

  it('rejects non-letter, non-action characters', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    instance._handleKeyDown('é', false, false);
    expect(props.updateGrid).not.toHaveBeenCalled();
  });

  it('accepts digit keys', () => {
    const {instance, props} = makeControlsInstance(GridControls);
    jest.useFakeTimers();
    instance._handleKeyDown('5', false, false);
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '5');
    jest.useRealTimers();
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
