import {vi} from 'vitest';
import MobileGridControls from '../MobileGridControls';
import {makeGrid, makeDefaultProps} from '../testHelpers';

function makeMobileInstance(overrides = {}) {
  const props = makeDefaultProps({
    size: 30,
    enablePan: false,
    onSetCursorLock: vi.fn(),
    onChangeDirection: vi.fn(),
    ...overrides,
  });
  const instance = new MobileGridControls(props);
  instance.props = props;
  instance.inputRef = {
    current: {
      focus: vi.fn(),
      value: '$',
      selectionStart: 1,
      selectionEnd: 1,
    },
  };
  instance.zoomContainer = {
    current: {
      getBoundingClientRect: () => ({x: 0, y: 0, width: 300, height: 300}),
    },
  };
  instance.state = {
    anchors: [],
    transform: {scale: 1, translateX: 0, translateY: 0},
    dbgstr: undefined,
  };
  instance.setState = vi.fn((updater) => {
    if (typeof updater === 'function') {
      Object.assign(instance.state, updater(instance.state));
    } else {
      Object.assign(instance.state, updater);
    }
  });
  return {instance, props};
}

function makeInputEvent(value) {
  return {
    target: {
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
    },
  };
}

describe('MobileGridControls.handleInputChange — letter input', () => {
  it('types a letter when input changes from "$" to "$a"', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    instance.handleInputChange(makeInputEvent('$a'));
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'A');
    vi.useRealTimers();
  });

  it('types multiple letters for gesture keyboard input "$hello"', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    instance.handleInputChange(makeInputEvent('$hello'));
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });

  it('handles digit input', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    instance.handleInputChange(makeInputEvent('$5'));
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '5');
    vi.useRealTimers();
  });
});

describe('MobileGridControls.handleInputChange — backspace', () => {
  it('triggers backspace when input becomes empty', () => {
    const {instance, props} = makeMobileInstance({
      grid: makeGrid({'0,0': {value: 'A'}}),
    });
    vi.useFakeTimers();
    instance.handleInputChange(makeInputEvent(''));
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '');
    vi.useRealTimers();
  });
});

describe('MobileGridControls.handleInputChange — special inputs', () => {
  it('handles space input (direction flip)', () => {
    const {instance, props} = makeMobileInstance();
    instance.handleInputChange(makeInputEvent('$ '));
    expect(props.onSetDirection).toHaveBeenCalled();
  });

  it('handles @ as space (iOS email keyboard quirk)', () => {
    const {instance, props} = makeMobileInstance();
    instance.handleInputChange(makeInputEvent('$@'));
    expect(props.onSetDirection).toHaveBeenCalled();
  });

  it('handles period input', () => {
    const {instance, props} = makeMobileInstance();
    instance.handleInputChange(makeInputEvent('$.'));
    expect(props.onPressPeriod).toHaveBeenCalled();
  });

  it('handles comma input (tab to next clue) without throwing', () => {
    const {instance} = makeMobileInstance();
    expect(() => instance.handleInputChange(makeInputEvent('$,'))).not.toThrow();
  });
});

describe('MobileGridControls — validLetter regression', () => {
  it('does not have validLetter as an instance method', () => {
    // validLetter must be a standalone import, not a class method.
    // If it ever becomes a class method again, the coupling is fragile.
    const {instance} = makeMobileInstance();
    expect(instance.validLetter).toBeUndefined();
  });

  it('processes letter input without throwing (the exact regression)', () => {
    // This is THE critical test. Before the fix, this threw:
    // TypeError: this.validLetter is not a function
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    expect(() => {
      instance.handleInputChange(makeInputEvent('$A'));
    }).not.toThrow();
    vi.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('MobileGridControls.handleInputChange — IME composition (Android keyboards)', () => {
  // Gboard / FUTO / SwiftKey keep their own copy of the text and compose words across keystrokes. The box
  // must never be rewritten under them while focused, and each event must only relay what changed.
  function typeComposed(instance, values) {
    const target = {value: '$', selectionStart: 1, selectionEnd: 1};
    for (const value of values) {
      target.value = value;
      instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    }
    return target;
  }

  it('types each letter once while the keyboard composes "abc"', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    const target = typeComposed(instance, ['$a', '$ab', '$abc']);
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map((c) => c[2])).toEqual(['A', 'B', 'C']);
    expect(target.value).toBe('$abc');
    vi.useRealTimers();
  });

  it('treats a shrinking composition as a single backspace', () => {
    const {instance, props} = makeMobileInstance({grid: makeGrid({'0,0': {value: 'A'}})});
    vi.useFakeTimers();
    const target = {value: '$a', selectionStart: 2, selectionEnd: 2};
    instance.lastInputValues.set(target, '$ab');
    instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls).toEqual([[0, 0, '']]);
    expect(target.value).toBe('$a');
    vi.useRealTimers();
  });

  it('spaces out backspaces when the keyboard rewrites several composed letters', () => {
    const {instance, props} = makeMobileInstance({grid: makeGrid({'0,0': {value: 'A'}})});
    vi.useFakeTimers();
    const target = {value: '$ax', selectionStart: 3, selectionEnd: 3};
    instance.lastInputValues.set(target, '$abc');
    instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    // Only the first step runs synchronously; the rest wait for the parent to re-render.
    expect(props.updateGrid).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map((c) => c[2])).toEqual(['', '', 'X']);
    vi.useRealTimers();
  });

  it('does not treat a dropped "$" as deleting the composition', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    const target = {value: 'abcd', selectionStart: 4, selectionEnd: 4};
    instance.lastInputValues.set(target, '$abc');
    instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map((c) => c[2])).toEqual(['D']);
    expect(target.value).toBe('abcd');
    vi.useRealTimers();
  });

  it('does not backspace a letter when a rejected character is removed', () => {
    const {instance, props} = makeMobileInstance({grid: makeGrid({'0,0': {value: 'N'}})});
    vi.useFakeTimers();
    const target = typeComposed(instance, ['$d', '$do', '$don', "$don'", '$don']);
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map((c) => c[2])).toEqual(['D', 'O', 'N']);
    expect(target.value).toBe('$don');
    vi.useRealTimers();
  });

  it('keeps an active composition intact when the "$" was dropped', () => {
    const {instance} = makeMobileInstance();
    vi.useFakeTimers();
    const target = typeComposed(instance, ['$a', 'ab']);
    vi.runAllTimers();
    expect(target.value).toBe('ab');
    vi.useRealTimers();
  });

  it('never rewrites the box while typing, even after the keyboard finishes a word', () => {
    const {instance} = makeMobileInstance();
    vi.useFakeTimers();
    const target = typeComposed(instance, ['$a', '$ab', '$ab ']);
    vi.runAllTimers();
    expect(target.value).toBe('$ab ');
    vi.useRealTimers();
  });

  it('backspace that reopens the last word deletes one letter instead of retyping it', () => {
    // The Discord report: type a word, press backspace, and the whole word came back followed by "$".
    const {instance, props} = makeMobileInstance({grid: makeGrid({'0,0': {value: 'S'}})});
    vi.useFakeTimers();
    const target = typeComposed(instance, ['$i', '$id', '$idi', '$idib', '$idibs']);
    vi.runAllTimers();
    props.updateGrid.mockClear();
    target.value = '$idib';
    instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls).toEqual([[0, 0, '']]);
    vi.useRealTimers();
  });

  it('never types a displaced "$" into the grid', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    const target = {value: 'ab$', selectionStart: 3, selectionEnd: 3};
    instance.handleInputChange({target});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map((c) => c[2])).toEqual(['A', 'B']);
    vi.useRealTimers();
  });

  it('types a "$" the user entered', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    const target = {value: '$$', selectionStart: 2, selectionEnd: 2};
    instance.handleInputChange({target});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls.map((c) => c[2])).toEqual(['$']);
    vi.useRealTimers();
  });

  it('backspace after a space reaches the grid', () => {
    const {instance, props} = makeMobileInstance({grid: makeGrid({'0,0': {value: 'C'}})});
    vi.useFakeTimers();
    const target = {value: '$abc ', selectionStart: 5, selectionEnd: 5};
    instance.lastInputValues.set(target, '$abc');
    instance.handleInputChange({target});
    expect(props.onSetDirection).toHaveBeenCalledTimes(1);
    target.value = '$abc';
    instance.handleInputChange({target});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls).toEqual([[0, 0, '']]);
    vi.useRealTimers();
  });

  it('restores the "$" once the box is emptied', () => {
    const {instance, props} = makeMobileInstance({grid: makeGrid({'0,0': {value: 'A'}})});
    vi.useFakeTimers();
    const target = {value: '', selectionStart: 0, selectionEnd: 0};
    instance.handleInputChange({target});
    vi.runAllTimers();
    expect(props.updateGrid.mock.calls).toEqual([[0, 0, '']]);
    expect(target.value).toBe('$');
    vi.useRealTimers();
  });

  it('resets the box on blur', () => {
    const {instance} = makeMobileInstance();
    const target = {name: '2', value: '$abc', selectionStart: 4, selectionEnd: 4};
    instance.handleInputBlur({target});
    expect(target.value).toBe('$');
  });
});

describe('MobileGridControls.handleInputChange — ordering across events', () => {
  it('runs a space after letters still pending from the previous event', () => {
    const {instance, props} = makeMobileInstance();
    vi.useFakeTimers();
    const target = {value: '$hello', selectionStart: 6, selectionEnd: 6};
    instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    target.value = '$hello ';
    instance.handleInputChange({target, nativeEvent: {isComposing: true}});
    expect(props.onSetDirection).not.toHaveBeenCalled();
    vi.runAllTimers();
    const lastLetter = Math.max(...props.updateGrid.mock.invocationCallOrder);
    expect(props.updateGrid).toHaveBeenCalledTimes(5);
    expect(props.onSetDirection.mock.invocationCallOrder[0]).toBeGreaterThan(lastLetter);
    vi.useRealTimers();
  });
});

describe('MobileGridControls — hidden box focus hand-off', () => {
  // iOS WebKit focuses a textarea when its selection is set. Emulate that on real textareas wired to the
  // component's handlers the way React wires them.
  function mountIosBoxes(instance) {
    const boxes = ['1', '2', '3'].map((name) => {
      const box = document.createElement('textarea');
      box.name = name;
      box.value = '$';
      const {set} = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'selectionStart');
      Object.defineProperty(box, 'selectionStart', {
        configurable: true,
        get: () => box.value.length,
        set(v) {
          set.call(box, v);
          if (document.activeElement !== box) box.focus();
        },
      });
      box.addEventListener('focus', (e) => instance.handleInputFocus(e));
      box.addEventListener('blur', (e) => instance.handleInputBlur(e));
      document.body.appendChild(box);
      return box;
    });
    instance.inputRef = {current: boxes[1]};
    return boxes;
  }

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('moves one clue and settles on box 2 when focus lands on box 3 (iPad Tab)', () => {
    const {instance} = makeMobileInstance();
    const selectNextClue = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    vi.useFakeTimers();
    const [, main, next] = mountIosBoxes(instance);
    main.focus();
    selectNextClue.mockClear();

    next.focus();
    // Before the fix each deferred selection write refocused box 3 and the loop never drained.
    for (let i = 0; i < 20; i += 1) vi.runOnlyPendingTimers();

    expect(vi.getTimerCount()).toBe(0);
    expect(selectNextClue).toHaveBeenCalledTimes(1);
    expect(selectNextClue).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(main);
  });

  it('does not refocus box 2 after it is blurred', () => {
    const {instance} = makeMobileInstance();
    vi.useFakeTimers();
    const [, main] = mountIosBoxes(instance);
    main.focus();
    main.blur();
    vi.runAllTimers();
    expect(document.activeElement).not.toBe(main);
  });

  it('handles a hardware Tab on the main box without moving focus', () => {
    const {instance} = makeMobileInstance();
    const selectNextClue = vi.spyOn(instance, 'selectNextClue').mockImplementation(() => {});
    const forward = {key: 'Tab', shiftKey: false, preventDefault: vi.fn(), target: {blur: vi.fn()}};
    instance.handleMainInputKeyDown(forward);
    expect(forward.preventDefault).toHaveBeenCalled();
    expect(selectNextClue).toHaveBeenLastCalledWith(false);

    const back = {key: 'Tab', shiftKey: true, preventDefault: vi.fn(), target: {blur: vi.fn()}};
    instance.handleMainInputKeyDown(back);
    expect(selectNextClue).toHaveBeenLastCalledWith(true);
  });

  it('still blurs on volume keys from the main box', () => {
    const {instance} = makeMobileInstance();
    const ev = {key: 'AudioVolumeUp', preventDefault: vi.fn(), target: {blur: vi.fn()}};
    instance.handleMainInputKeyDown(ev);
    expect(ev.target.blur).toHaveBeenCalled();
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });
});
