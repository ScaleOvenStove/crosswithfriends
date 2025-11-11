import React, {forwardRef, useCallback, useMemo} from 'react';
import MobileGridControls, {MobileGridControlsRef} from './MobileGridControls';
import {UseGridControlsProps, GridControlsActions, useGridControls} from './useGridControls';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';

interface MobileListViewControlsProps extends UseGridControlsProps {
  size: number;
  enablePan?: boolean;
  onSetCursorLock?: (locked: boolean) => void;
  onChangeDirection?: () => void;
  enableDebug?: boolean;
  children?: React.ReactNode;
}

const MobileListViewControls = forwardRef<MobileGridControlsRef, MobileListViewControlsProps>(
  (props, ref) => {
    const grid = useMemo(() => new GridObject(props.grid), [props.grid]);

    // Use the hook to get base methods
    const gridControls = useGridControls(props);
    const {selectNextClue, flipDirection, moveToEdge, deleteCell: baseDeleteCell} = gridControls;

    const moveToNextCell = useCallback(() => {
      const {r, c} = props.selected;
      const nextCell = grid.getNextCell(r, c, props.direction);
      if (nextCell) {
        props.onSetSelected(nextCell);
        return nextCell;
      }
      selectNextClue();
    }, [props.selected, props.direction, props.onSetSelected, grid, selectNextClue]);

    const moveToPreviousCell = useCallback(() => {
      const {r, c} = props.selected;
      const previousCell = grid.getPreviousCell(r, c, props.direction);
      if (previousCell) {
        props.onSetSelected(previousCell);
        return previousCell;
      }
      selectNextClue(true);
    }, [props.selected, props.direction, props.onSetSelected, grid, selectNextClue]);

    const selectPreviousClue = useCallback(() => {
      selectNextClue(true);
    }, [selectNextClue]);

    const backspace = useCallback(
      (shouldStay: any = false) => {
        const {r, c} = props.selected;
        const deleteCellLocal = () => {
          if (props.grid[r][c].value !== '' && !props.grid[r][c].good) {
            props.updateGrid(r, c, '');
            return true;
          }
          return false;
        };
        if (!deleteCellLocal() && !shouldStay) {
          const cell = moveToPreviousCell();
          if (cell) {
            props.updateGrid(cell.r, cell.c, '');
          }
        }
      },
      [props.selected, props.grid, props.updateGrid, moveToPreviousCell]
    );

    const deleteCell = useCallback(() => {
      const {r, c} = props.selected;
      if (props.grid[r][c].value !== '' && !props.grid[r][c].good) {
        props.updateGrid(r, c, '');
        return true;
      }
      return false;
    }, [props.selected, props.grid, props.updateGrid]);

    // Create custom actions that override the defaults
    const customActions = useMemo<Partial<GridControlsActions>>(
      () => ({
        left: () => moveToPreviousCell(),
        up: () => selectPreviousClue(),
        down: () => selectNextClue(false),
        right: () => moveToNextCell(),
        forward: () => selectNextClue(false),
        backward: () => selectPreviousClue(),
        backspace: () => backspace(),
        home: moveToEdge(true),
        end: moveToEdge(false),
        delete: () => deleteCell(),
        tab: () => selectNextClue(false),
        space: () => flipDirection(),
      }),
      [
        moveToNextCell,
        moveToPreviousCell,
        selectPreviousClue,
        selectNextClue,
        backspace,
        moveToEdge,
        deleteCell,
        flipDirection,
      ]
    );

    return <MobileGridControls ref={ref} {...props} enablePan={false} actions={customActions} />;
  }
);

MobileListViewControls.displayName = 'MobileListViewControls';

export default MobileListViewControls;
