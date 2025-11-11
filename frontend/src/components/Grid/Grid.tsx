import './css/index.css';

import React, {useMemo, useCallback} from 'react';
import _ from 'lodash';
import GridWrapper from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import RerenderBoundary from '../RerenderBoundary';
import {hashGridRow} from './hashGridRow';
import Cell from './Cell';
import {GridDataWithColor, CellCoords, ClueCoords, BattlePickup, CellStyles, Ping} from './types';
import {CellIndex, Cursor, GridData, toCellIndex} from '@crosswithfriends/shared/types';

export interface GridProps {
  // Grid data
  solution: string[][];
  grid: GridDataWithColor;
  opponentGrid: GridData;

  // Cursor state
  selected: CellCoords;
  direction: 'across' | 'down';

  // Cell annotations
  circles?: CellIndex[];
  shades?: CellIndex[];
  pings?: Ping[];
  cursors: Cursor[];

  // Styles & related
  references: ClueCoords[];
  pickups?: BattlePickup[];
  cellStyle: CellStyles;
  myColor: string;

  // Edit modes
  size: number;
  editMode: boolean;
  frozen: boolean;

  // callbacks
  onChangeDirection(): void;
  onSetSelected(cellCoords: CellCoords): void;
  onPing?(r: number, c: number): void;
  canFlipColor?(r: number, c: number): boolean;
  onFlipColor?(r: number, c: number): void;
}

const Grid: React.FC<GridProps> = (props) => {
  const grid = useMemo(() => new GridWrapper(props.grid), [props.grid]);

  const opponentGrid = useMemo(() => {
    return props.opponentGrid ? new GridWrapper(props.opponentGrid) : null;
  }, [props.opponentGrid]);

  const selectedIsWhite = useMemo(() => {
    return grid.isWhite(props.selected.r, props.selected.c);
  }, [grid, props.selected]);

  const isSelected = useCallback(
    (r: number, c: number) => {
      return r === props.selected.r && c === props.selected.c;
    },
    [props.selected]
  );

  const isCircled = useCallback(
    (r: number, c: number) => {
      const idx = toCellIndex(r, c, props.grid[0].length);
      return (props.circles || []).indexOf(idx) !== -1;
    },
    [props.grid, props.circles]
  );

  const isDoneByOpponent = useCallback(
    (r: number, c: number) => {
      if (!opponentGrid || !props.solution) {
        return false;
      }
      return opponentGrid.isFilled(r, c) && props.solution[r][c] === props.opponentGrid[r][c].value;
    },
    [opponentGrid, props.solution, props.opponentGrid]
  );

  const isShaded = useCallback(
    (r: number, c: number) => {
      const idx = toCellIndex(r, c, props.grid[0].length);
      return (props.shades || []).indexOf(idx) !== -1 || isDoneByOpponent(r, c);
    },
    [props.grid, props.shades, isDoneByOpponent]
  );

  const isHighlighted = useCallback(
    (r: number, c: number) => {
      if (!selectedIsWhite) return false;
      const selectedParent = grid.getParent(props.selected.r, props.selected.c, props.direction);
      return (
        !isSelected(r, c) && grid.isWhite(r, c) && grid.getParent(r, c, props.direction) === selectedParent
      );
    },
    [selectedIsWhite, grid, props.selected, props.direction, isSelected]
  );

  const isReferenced = useCallback(
    (r: number, c: number) => {
      return props.references.some((clue) => clueContainsSquare(clue, r, c));
    },
    [props.references]
  );

  const getPickup = useCallback(
    (r: number, c: number) => {
      return (
        props.pickups &&
        _.get(
          _.find(props.pickups, ({i, j, pickedUp}) => i === r && j === c && !pickedUp),
          'type'
        )
      );
    },
    [props.pickups]
  );

  const clueContainsSquare = useCallback(
    ({ori, num}: ClueCoords, r: number, c: number) => {
      return grid.isWhite(r, c) && grid.getParent(r, c, ori) === num;
    },
    [grid]
  );

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (!grid.isWhite(r, c) && !props.editMode) return;
      if (isSelected(r, c)) {
        props.onChangeDirection();
      } else {
        props.onSetSelected({r, c});
      }
    },
    [grid, props.editMode, isSelected, props.onChangeDirection, props.onSetSelected]
  );

  const handleRightClick = useCallback(
    (r: number, c: number) => {
      if (props.onPing) {
        props.onPing(r, c);
      }
    },
    [props.onPing]
  );

  const getSizeClass = useCallback((size: number) => {
    if (size < 20) {
      return 'tiny';
    }
    if (size < 25) {
      return 'small';
    }
    if (size < 40) {
      return 'medium';
    }
    return 'big';
  }, []);

  const {size, cellStyle} = props;
  const sizeClass = getSizeClass(size);

  const data = useMemo(() => {
    return props.grid.map((row, r) =>
      row.map((cell, c) => ({
        ...cell,
        r,
        c,
        solvedByIconSize: Math.round(size / 10),
        selected: isSelected(r, c),
        referenced: isReferenced(r, c),
        circled: isCircled(r, c),
        shaded: isShaded(r, c),
        canFlipColor: !!props.canFlipColor?.(r, c),
        cursors: (props.cursors || []).filter((cursor) => cursor.r === r && cursor.c === c),
        pings: (props.pings || []).filter((ping) => ping.r === r && ping.c === c),
        highlighted: isHighlighted(r, c),
        myColor: props.myColor,
        frozen: props.frozen,
        pickupType: getPickup(r, c),
        cellStyle,
      }))
    );
  }, [
    props.grid,
    size,
    isSelected,
    isReferenced,
    isCircled,
    isShaded,
    isHighlighted,
    props.cursors,
    props.pings,
    props.myColor,
    props.frozen,
    getPickup,
    props.canFlipColor,
    cellStyle,
  ]);

  return (
    <table
      style={{
        width: props.grid[0].length * props.size,
        height: props.grid.length * props.size,
      }}
      className={`grid ${sizeClass}`}
    >
      <tbody>
        {data.map((row, i) => (
          <RerenderBoundary
            name={`grid row ${i}`}
            key={i}
            hash={hashGridRow(row, {...props.cellStyle, size})}
          >
            <tr>
              {row.map((cellProps) => (
                <td
                  key={`${cellProps.r}_${cellProps.c}`}
                  className="grid--cell"
                  data-rc={`${cellProps.r} ${cellProps.c}`}
                  style={{
                    width: size,
                    height: size,
                    fontSize: `${size * 0.15}px`,
                  }}
                >
                  <Cell
                    {...cellProps}
                    onClick={handleClick}
                    onContextMenu={handleRightClick}
                    onFlipColor={props.onFlipColor}
                  />
                </td>
              ))}
            </tr>
          </RerenderBoundary>
        ))}
      </tbody>
    </table>
  );
};

export default React.memo(Grid);
