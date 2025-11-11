import {useRef, useMemo, useCallback} from 'react';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';

function safe_while(condition: () => boolean, step: () => void, cap = 500) {
  while (condition() && cap >= 0) {
    step();
    cap -= 1;
  }
}

export interface UseGridControlsProps {
  grid: any;
  selected: {r: number; c: number};
  direction: 'across' | 'down';
  clues: any;
  editMode: boolean;
  frozen: boolean;
  beta?: boolean;
  vimMode?: boolean;
  vimInsert?: boolean;
  vimCommand?: boolean;
  onSetDirection: (direction: 'across' | 'down') => void;
  canSetDirection: (direction: 'across' | 'down') => boolean;
  onSetSelected: (selected: {r: number; c: number}) => void;
  updateGrid: (r: number, c: number, value: string) => void;
  onCheck?: (scope: string) => void;
  onReveal?: (scope: string) => void;
  onPressEnter?: () => void;
  onPressPeriod?: () => void;
  onPressEscape?: () => void;
  onVimNormal?: () => void;
  onVimInsert?: () => void;
  onVimCommand?: () => void;
}

export interface GridControlsActions {
  left: (shiftKey?: boolean) => void;
  up: (shiftKey?: boolean) => void;
  down: (shiftKey?: boolean) => void;
  right: (shiftKey?: boolean) => void;
  forward: (shiftKey?: boolean) => void;
  backward: (shiftKey?: boolean) => void;
  home: (shiftKey?: boolean) => void;
  end: (shiftKey?: boolean) => void;
  backspace: (shiftKey?: boolean) => void;
  delete: (shiftKey?: boolean) => void;
  tab: (shiftKey?: boolean) => void;
  space: (shiftKey?: boolean) => void;
}

export interface UseGridControlsReturn {
  grid: GridObject;
  inputRef: React.RefObject<HTMLInputElement>;
  nextTimeRef: React.MutableRefObject<number>;
  focus: () => void;
  getSelectedClueNumber: () => number;
  isSelectable: (r: number, c: number) => boolean;
  isClueSelectable: (direction: 'across' | 'down', clueNumber: number) => boolean;
  setDirection: (direction: 'across' | 'down') => void;
  setSelected: (selected: {r: number; c: number}) => void;
  selectClue: (direction: 'across' | 'down', number: number) => void;
  selectNextClue: (backwards?: boolean, parallel?: boolean) => void;
  moveSelectedBy: (dr: number, dc: number) => () => void;
  moveSelectedUsingDirection: (d: number) => () => void;
  moveToEdge: (start: boolean) => () => void;
  flipDirection: () => void;
  setDirectionWithCallback: (direction: 'across' | 'down', cbk: () => void) => () => void;
  goToNextEmptyCell: (options?: {nextClueIfFilled?: boolean}) => void | {r: number; c: number};
  goToPreviousCell: () => {r: number; c: number} | undefined;
  deleteCell: () => boolean;
  backspace: (shouldStay?: boolean) => void;
  typeLetterSync: (letter: string, isRebus: boolean, options?: {nextClueIfFilled?: boolean}) => void;
  typeLetter: (letter: string, isRebus: boolean, options?: {nextClueIfFilled?: boolean}) => void;
  validLetter: (letter: string) => boolean;
  handleAltKey: (key: string, shiftKey: boolean) => void;
  actions: GridControlsActions;
  handleAction: (action: string, shiftKey?: boolean) => void;
  handleKeyDown: (key: string, shiftKey: boolean, altKey: boolean) => boolean;
  handleKeyDownVim: (key: string, shiftKey: boolean, altKey: boolean) => boolean;
}

export function useGridControls(
  props: UseGridControlsProps,
  customActions?: Partial<GridControlsActions>
): UseGridControlsReturn {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextTimeRef = useRef<number>(0);

  const grid = useMemo(() => new GridObject(props.grid), [props.grid]);

  const getSelectedClueNumber = useCallback(() => {
    return grid.getParent(props.selected.r, props.selected.c, props.direction);
  }, [grid, props.selected, props.direction]);

  const focus = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus({preventScroll: true});
    }
  }, []);

  const isSelectable = useCallback(
    (r: number, c: number) => {
      return (props.editMode || grid.isWhite(r, c)) && !props.grid[r][c].isHidden;
    },
    [props.editMode, props.grid, grid]
  );

  const isClueSelectable = useCallback(
    (direction: 'across' | 'down', clueNumber: number) => {
      const clueRoot = grid.getCellByNumber(clueNumber);
      if (!clueRoot) return false;
      let {r, c} = clueRoot;
      while (grid.isInBounds(r, c) && grid.isWhite(r, c) && grid.getParent(r, c, direction) === clueNumber) {
        if (isSelectable(r, c)) {
          return true;
        }
        if (direction === 'across') c++;
        else r++;
      }
      return false;
    },
    [grid, isSelectable]
  );

  const setDirection = useCallback(
    (direction: 'across' | 'down') => {
      props.onSetDirection(direction);
    },
    [props.onSetDirection]
  );

  const setSelected = useCallback(
    (selected: {r: number; c: number}) => {
      props.onSetSelected(selected);
    },
    [props.onSetSelected]
  );

  const selectClue = useCallback(
    (direction: 'across' | 'down', number: number) => {
      const clueRoot = grid.getCellByNumber(number);
      if (clueRoot) {
        setDirection(direction);
        const firstEmptyCell = grid.getNextEmptyCell(clueRoot.r, clueRoot.c, direction);
        let targetCell = firstEmptyCell || clueRoot;
        while (targetCell && !isSelectable(targetCell.r, targetCell.c)) {
          const nextCell = grid.getNextCell(targetCell.r, targetCell.c, direction);
          if (!nextCell) break;
          targetCell = nextCell;
        }
        if (targetCell && isSelectable(targetCell.r, targetCell.c)) {
          setSelected(targetCell);
        }
      }
    },
    [grid, setDirection, isSelectable, setSelected]
  );

  const selectNextClue = useCallback(
    (backwards = false, parallel = false) => {
      let currentClueNumber = getSelectedClueNumber();
      let currentDirection = props.direction;
      const trySelectNextClue = () => {
        const {direction, clueNumber} = grid.getNextClue(
          currentClueNumber,
          currentDirection,
          props.clues,
          backwards,
          parallel
        );
        currentClueNumber = clueNumber;
        currentDirection = direction;
      };
      const hasSelectableCells = () => isClueSelectable(currentDirection, currentClueNumber);

      trySelectNextClue();
      safe_while(() => !hasSelectableCells(), trySelectNextClue);
      selectClue(currentDirection, currentClueNumber);
    },
    [getSelectedClueNumber, props.direction, props.clues, grid, isClueSelectable, selectClue]
  );

  const moveSelectedBy = useCallback(
    (dr: number, dc: number) => {
      return () => {
        let {r, c} = props.selected;
        const step = () => {
          r += dr;
          c += dc;
        };
        step();
        safe_while(() => grid.isInBounds(r, c) && !isSelectable(r, c), step);
        if (grid.isInBounds(r, c)) {
          setSelected({r, c});
        }
      };
    },
    [props.selected, grid, isSelectable, setSelected]
  );

  const moveSelectedUsingDirection = useCallback(
    (d: number) => {
      return () => {
        const [dr, dc] = props.direction === 'down' ? [0, d] : [d, 0];
        return moveSelectedBy(dr, dc)();
      };
    },
    [props.direction, moveSelectedBy]
  );

  const moveToEdge = useCallback(
    (start: boolean) => {
      return () => {
        let {r, c} = props.selected;
        ({r, c} = grid.getEdge(r, c, props.direction, start));
        if (grid.isInBounds(r, c)) {
          setSelected({r, c});
        }
      };
    },
    [props.selected, props.direction, grid, setSelected]
  );

  const flipDirection = useCallback(() => {
    if (props.direction === 'across') {
      if (props.canSetDirection('down')) {
        setDirection('down');
      }
    } else if (props.canSetDirection('across')) {
      setDirection('across');
    }
  }, [props.direction, props.canSetDirection, setDirection]);

  const setDirectionWithCallback = useCallback(
    (direction: 'across' | 'down', cbk: () => void) => {
      return () => {
        if (props.direction !== direction) {
          if (props.canSetDirection(direction)) {
            setDirection(direction);
          } else {
            cbk();
          }
        } else {
          cbk();
        }
      };
    },
    [props.direction, props.canSetDirection, setDirection]
  );

  const goToNextEmptyCell = useCallback(
    ({nextClueIfFilled = false} = {}) => {
      const {r, c} = props.selected;
      const nextEmptyCell = grid.getNextEmptyCell(r, c, props.direction, {
        skipFirst: true,
      });
      if (nextEmptyCell) {
        setSelected(nextEmptyCell);
        return nextEmptyCell;
      }
      const nextCell = grid.getNextCell(r, c, props.direction);
      if (nextCell) {
        setSelected(nextCell);
        return nextCell;
      }
      if (nextClueIfFilled) {
        selectNextClue();
      }
    },
    [props.selected, props.direction, grid, setSelected, selectNextClue]
  );

  const goToPreviousCell = useCallback(() => {
    let {r, c} = props.selected;
    const gridData = props.grid;
    const step = () => {
      if (props.direction === 'across') {
        if (c > 0) {
          c--;
        } else {
          c = gridData[0].length - 1;
          r--;
        }
      } else if (r > 0) {
        r--;
      } else {
        r = gridData.length - 1;
        c--;
      }
    };
    const ok = () => grid.isInBounds(r, c) && grid.isWhite(r, c);
    step();
    safe_while(() => grid.isInBounds(r, c) && !ok(), step);
    if (ok()) {
      setSelected({r, c});
      return {r, c};
    }
    return undefined;
  }, [props.selected, props.direction, props.grid, grid, setSelected]);

  const deleteCell = useCallback(() => {
    const {r, c} = props.selected;
    if (props.grid[r][c].value !== '' && !props.grid[r][c].good) {
      props.updateGrid(r, c, '');
      return true;
    }
    return false;
  }, [props.selected, props.grid, props.updateGrid]);

  const backspace = useCallback(
    (shouldStay = false) => {
      if (!deleteCell() && !shouldStay) {
        const cell = goToPreviousCell();
        if (cell) {
          props.updateGrid(cell.r, cell.c, '');
        }
      }
    },
    [deleteCell, goToPreviousCell, props.updateGrid]
  );

  const typeLetterSync = useCallback(
    (letter: string, isRebus: boolean, {nextClueIfFilled}: {nextClueIfFilled?: boolean} = {}) => {
      if (letter === '/') isRebus = true;
      const {r, c} = props.selected;
      const value = props.grid[r][c].value;
      if (!isRebus) {
        goToNextEmptyCell({nextClueIfFilled});
      }
      props.updateGrid(r, c, isRebus ? (value || '').substr(0, 10) + letter : letter);
    },
    [props.selected, props.grid, props.updateGrid, goToNextEmptyCell]
  );

  const typeLetter = useCallback(
    (letter: string, isRebus: boolean, {nextClueIfFilled}: {nextClueIfFilled?: boolean} = {}) => {
      const {r, c} = props.selected;
      if (!isSelectable(r, c)) {
        return;
      }
      if (props.beta) {
        return typeLetterSync(letter, isRebus, {nextClueIfFilled});
      }
      if (!nextTimeRef.current) nextTimeRef.current = Date.now();
      setTimeout(
        () => {
          let rebus = isRebus;
          if (letter === '/') rebus = true;
          const {r: r2, c: c2} = props.selected;
          const value = props.grid[r2][c2].value;
          if (!rebus) {
            goToNextEmptyCell({nextClueIfFilled});
          }
          props.updateGrid(r2, c2, rebus ? (value || '').substr(0, 10) + letter : letter);
        },
        Math.max(0, nextTimeRef.current - Date.now())
      );
      nextTimeRef.current = Math.max(nextTimeRef.current, Date.now()) + 30;
    },
    [
      props.selected,
      props.beta,
      props.grid,
      props.updateGrid,
      isSelectable,
      typeLetterSync,
      goToNextEmptyCell,
    ]
  );

  const validLetter = useCallback((letter: string) => {
    const VALID_SYMBOLS = '!@#$%^&*()-+=`~/?\\';
    if (VALID_SYMBOLS.indexOf(letter) !== -1) return true;
    return letter.match(/^[A-Z0-9]$/);
  }, []);

  const handleAltKey = useCallback(
    (key: string, shiftKey: boolean) => {
      key = key.toLowerCase();
      const altAction = shiftKey ? props.onReveal : props.onCheck;
      if (!altAction) return;
      if (key === 's') {
        altAction('square');
      }
      if (key === 'w') {
        altAction('word');
      }
      if (key === 'p') {
        altAction('puzzle');
      }
    },
    [props.onReveal, props.onCheck]
  );

  const defaultActions = useMemo(
    () => ({
      left: setDirectionWithCallback('across', moveSelectedBy(0, -1)),
      up: setDirectionWithCallback('down', moveSelectedBy(-1, 0)),
      down: setDirectionWithCallback('down', moveSelectedBy(1, 0)),
      right: setDirectionWithCallback('across', moveSelectedBy(0, 1)),
      forward: moveSelectedUsingDirection(1),
      backward: moveSelectedUsingDirection(-1),
      home: moveToEdge(true),
      end: moveToEdge(false),
      backspace,
      delete: deleteCell,
      tab: selectNextClue,
      space: flipDirection,
    }),
    [
      setDirectionWithCallback,
      moveSelectedBy,
      moveSelectedUsingDirection,
      moveToEdge,
      backspace,
      deleteCell,
      selectNextClue,
      flipDirection,
    ]
  );

  const actions = useMemo(
    () => ({
      ...defaultActions,
      ...customActions,
    }),
    [defaultActions, customActions]
  );

  const handleAction = useCallback(
    (action: string, shiftKey?: boolean) => {
      if (!(action in actions)) {
        console.error('illegal action', action);
        return;
      }
      actions[action as keyof typeof actions](shiftKey);
    },
    [actions]
  );

  const handleKeyDown = useCallback(
    (key: string, shiftKey: boolean, altKey: boolean) => {
      const actionKeys: Record<string, string> = {
        ArrowLeft: 'left',
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowRight: 'right',
        Backspace: 'backspace',
        '{del}': 'backspace',
        Delete: 'delete',
        Tab: 'tab',
        ' ': 'space',
        '[': 'backward',
        ']': 'forward',
        Home: 'home',
        End: 'end',
      };

      if (shiftKey) {
        const isAcross = props.direction === 'across';
        actionKeys[isAcross ? 'ArrowUp' : 'ArrowLeft'] = 'backward';
        actionKeys[isAcross ? 'ArrowDown' : 'ArrowRight'] = 'forward';
      }

      if (key in actionKeys) {
        handleAction(actionKeys[key], shiftKey);
        return true;
      }
      if (key === '.') {
        props.onPressPeriod?.();
        return true;
      }
      if (key === 'Enter') {
        props.onPressEnter?.();
        return true;
      }
      if (altKey) {
        handleAltKey(key, shiftKey);
        return true;
      }
      if (key === 'Escape') {
        props.onPressEscape?.();
      } else if (!props.frozen) {
        const letter = key.toUpperCase();
        if (validLetter(letter)) {
          typeLetter(letter, shiftKey);
          return true;
        }
      }
      return false;
    },
    [
      props.direction,
      props.frozen,
      props.onPressPeriod,
      props.onPressEnter,
      props.onPressEscape,
      handleAction,
      handleAltKey,
      validLetter,
      typeLetter,
    ]
  );

  const handleKeyDownVim = useCallback(
    (key: string, shiftKey: boolean, altKey: boolean) => {
      const actionKeys: Record<string, string> = {
        ArrowLeft: 'left',
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowRight: 'right',
        Backspace: 'backspace',
        '{del}': 'backspace',
        Delete: 'delete',
        Tab: 'tab',
        ' ': 'space',
        '[': 'backward',
        ']': 'forward',
        Home: 'home',
        End: 'end',
      };

      const normalModeActionKeys: Record<string, string> = {
        h: 'left',
        j: 'down',
        k: 'up',
        l: 'right',
        x: 'delete',
        '^': 'home',
        $: 'end',
      };

      if (key in actionKeys) {
        handleAction(actionKeys[key], shiftKey);
        return true;
      }
      if (altKey) {
        handleAltKey(key, shiftKey);
        return true;
      }
      if (!props.vimInsert && !props.vimCommand) {
        if (key in normalModeActionKeys) {
          handleAction(normalModeActionKeys[key], shiftKey);
        } else if (key === 'w') {
          selectNextClue(false);
        } else if (key === 'b') {
          selectNextClue(true);
        } else if (key === 'i') {
          props.onVimInsert?.();
        } else if (key === 's') {
          deleteCell();
          props.onVimInsert?.();
        } else if (key === ':') {
          props.onVimCommand?.();
        }
      } else if (key === '.') {
        props.onPressPeriod?.();
        return true;
      } else if (key === 'Enter') {
        props.onPressEnter?.();
        return true;
      } else if (key === 'Escape') {
        props.onVimNormal?.();
      } else if (props.vimInsert && !props.frozen) {
        const letter = key.toUpperCase();
        if (validLetter(letter)) {
          typeLetter(letter, shiftKey);
          return true;
        }
      }
      return false;
    },
    [
      props.vimInsert,
      props.vimCommand,
      props.frozen,
      props.onPressPeriod,
      props.onPressEnter,
      props.onVimNormal,
      props.onVimInsert,
      props.onVimCommand,
      handleAction,
      handleAltKey,
      selectNextClue,
      deleteCell,
      validLetter,
      typeLetter,
    ]
  );

  return {
    grid,
    inputRef,
    nextTimeRef,
    focus,
    getSelectedClueNumber,
    isSelectable,
    isClueSelectable,
    setDirection,
    setSelected,
    selectClue,
    selectNextClue,
    moveSelectedBy,
    moveSelectedUsingDirection,
    moveToEdge,
    flipDirection,
    setDirectionWithCallback,
    goToNextEmptyCell,
    goToPreviousCell,
    deleteCell,
    backspace,
    typeLetterSync,
    typeLetter,
    validLetter,
    handleAltKey,
    actions,
    handleAction,
    handleKeyDown,
    handleKeyDownVim,
  };
}
