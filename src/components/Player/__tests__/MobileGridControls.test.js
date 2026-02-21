import MobileGridControls from '../MobileGridControls';
import {makeGrid, makeDefaultProps} from '../testHelpers';

function makeMobileInstance(overrides = {}) {
  const props = makeDefaultProps({
    size: 30,
    enablePan: false,
    onSetCursorLock: jest.fn(),
    onChangeDirection: jest.fn(),
    ...overrides,
  });
  const instance = new MobileGridControls(props);
  instance.props = props;
  instance.inputRef = {
    current: {
      focus: jest.fn(),
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
  instance.setState = jest.fn((updater) => {
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
    jest.useFakeTimers();
    instance.handleInputChange(makeInputEvent('$a'));
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'A');
    jest.useRealTimers();
  });

  it('types multiple letters for gesture keyboard input "$hello"', () => {
    const {instance, props} = makeMobileInstance();
    jest.useFakeTimers();
    instance.handleInputChange(makeInputEvent('$hello'));
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledTimes(5);
    jest.useRealTimers();
  });

  it('handles digit input', () => {
    const {instance, props} = makeMobileInstance();
    jest.useFakeTimers();
    instance.handleInputChange(makeInputEvent('$5'));
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '5');
    jest.useRealTimers();
  });
});

describe('MobileGridControls.handleInputChange — backspace', () => {
  it('triggers backspace when input becomes empty', () => {
    const {instance, props} = makeMobileInstance({
      grid: makeGrid({'0,0': {value: 'A'}}),
    });
    jest.useFakeTimers();
    instance.handleInputChange(makeInputEvent(''));
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalledWith(0, 0, '');
    jest.useRealTimers();
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
    jest.useFakeTimers();
    expect(() => {
      instance.handleInputChange(makeInputEvent('$A'));
    }).not.toThrow();
    jest.runAllTimers();
    expect(props.updateGrid).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
