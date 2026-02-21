import GridWrapper from '../../lib/wrappers/GridWrapper';

// 3x3 grid with black square at (1,1)
//  _ _ _
//  _ . _
//  _ _ _
export function makeGrid(cellOverrides = {}) {
  const grid = [
    [
      {value: '', black: false},
      {value: '', black: false},
      {value: '', black: false},
    ],
    [
      {value: '', black: false},
      {value: '', black: true},
      {value: '', black: false},
    ],
    [
      {value: '', black: false},
      {value: '', black: false},
      {value: '', black: false},
    ],
  ];
  const wrapper = new GridWrapper(grid);
  wrapper.assignNumbers();
  // Copy assigned parents/numbers back into the raw grid
  for (const [r, c] of wrapper.keys()) {
    grid[r][c] = {...grid[r][c], ...wrapper.grid[r][c]};
  }
  // Apply any cell-level overrides, keyed by "r,c"
  for (const key of Object.keys(cellOverrides)) {
    const [r, c] = key.split(',').map(Number);
    Object.assign(grid[r][c], cellOverrides[key]);
  }
  return grid;
}

export function makeDefaultProps(overrides = {}) {
  return {
    grid: makeGrid(),
    selected: {r: 0, c: 0},
    direction: 'across',
    clues: {across: [undefined, 'Clue 1A'], down: [undefined, 'Clue 1D']},
    frozen: false,
    editMode: false,
    beta: false,
    skipFilledSquares: true,
    updateGrid: jest.fn(),
    onSetSelected: jest.fn(),
    onSetDirection: jest.fn(),
    canSetDirection: jest.fn(() => true),
    onPressEnter: jest.fn(),
    onPressPeriod: jest.fn(),
    onPressEscape: jest.fn(),
    onCheck: jest.fn(),
    onReveal: jest.fn(),
    ...overrides,
  };
}

export function makeControlsInstance(ControlsClass, overrides = {}) {
  const props = makeDefaultProps(overrides);
  const instance = new ControlsClass(props);
  instance.props = props;
  instance.inputRef = {current: {focus: jest.fn()}};
  instance.setState = jest.fn((updater) => {
    if (typeof updater === 'function') {
      Object.assign(instance.state, updater(instance.state));
    } else {
      Object.assign(instance.state, updater);
    }
  });
  return {instance, props};
}
