import './css/index.css';

import GridWrapper from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import {toCellIndex} from '@crosswithfriends/shared/types';
import type {CellIndex, Cursor, GridData} from '@crosswithfriends/shared/types';
import React, {useMemo, useCallback} from 'react';

import RerenderBoundary from '../RerenderBoundary';

import Cell from './Cell';
import {hashGridRow} from './hashGridRow';
import type {GridDataWithColor, CellCoords, ClueCoords, BattlePickup, CellStyles, Ping} from './types';

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
  // Destructure props to avoid dependency issues
  const {
    grid: gridData,
    opponentGrid: opponentGridData,
    solution,
    selected,
    direction,
    circles,
    shades,
    pings,
    cursors,
    references,
    pickups,
    cellStyle,
    myColor,
    frozen,
    canFlipColor,
    size,
    onChangeDirection,
    onSetSelected,
    onPing,
    onFlipColor,
    editMode,
  } = props;

  const grid = useMemo(() => new GridWrapper(gridData), [gridData]);

  const opponentGrid = useMemo(() => {
    return opponentGridData ? new GridWrapper(opponentGridData) : null;
  }, [opponentGridData]);

  // Use Sets for O(1) lookups instead of O(n) indexOf
  const circlesSet = useMemo(() => {
    return new Set(circles || []);
  }, [circles]);

  const shadesSet = useMemo(() => {
    return new Set(shades || []);
  }, [shades]);

  // Index cursors and pings by cell for faster lookup
  const cursorsByCell = useMemo(() => {
    const map = new Map<string, Cursor[]>();
    (cursors || []).forEach((cursor) => {
      const key = `${cursor.r},${cursor.c}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(cursor);
    });
    return map;
  }, [cursors]);

  const pingsByCell = useMemo(() => {
    const map = new Map<string, Ping[]>();
    (pings || []).forEach((ping) => {
      const key = `${ping.r},${ping.c}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(ping);
    });
    return map;
  }, [pings]);

  // Index pickups by cell
  const pickupsByCell = useMemo(() => {
    const map = new Map<string, BattlePickup>();
    (pickups || []).forEach((pickup) => {
      if (!pickup.pickedUp) {
        const key = `${pickup.i},${pickup.j}`;
        map.set(key, pickup);
      }
    });
    return map;
  }, [pickups]);

  const cols = gridData[0].length;

  // Memoize selectedParent and selectedIsWhite to prevent infinite loops
  const selectedParent = useMemo(() => {
    return grid.getParent(selected.r, selected.c, direction);
  }, [grid, selected.r, selected.c, direction]);

  const selectedIsWhite = useMemo(() => {
    return grid.isWhite(selected.r, selected.c);
  }, [grid, selected.r, selected.c]);

  // Simple size class function (no need for useCallback)
  const getSizeClass = (s: number) => {
    if (s < 20) return 'tiny';
    if (s < 25) return 'small';
    if (s < 40) return 'medium';
    return 'big';
  };
  const sizeClass = getSizeClass(size);

  const data = useMemo(() => {
    return gridData.map((row, r) =>
      row.map((cell, c) => {
        const cellKey = `${r},${c}`;
        const cellIdx = toCellIndex(r, c, cols);
        const isCellSelected = r === selected.r && c === selected.c;
        const isCellWhite = !cell.black;

        // Check if done by opponent
        const isDoneByOpp = opponentGrid
          ? opponentGrid.isFilled(r, c) && solution[r]?.[c] === opponentGridData[r]?.[c]?.value
          : false;

        // Check if highlighted (same word as selected)
        const isHighlighted =
          selectedIsWhite &&
          isCellWhite &&
          !isCellSelected &&
          grid.getParent(r, c, direction) === selectedParent;

        // Check if referenced
        const isReferenced = references.some(
          (clue) => isCellWhite && grid.getParent(r, c, clue.ori) === clue.num
        );

        return {
          ...cell,
          r,
          c,
          solvedByIconSize: Math.round(size / 10),
          selected: isCellSelected,
          referenced: isReferenced,
          circled: circlesSet.has(cellIdx),
          shaded: shadesSet.has(cellIdx) || isDoneByOpp,
          canFlipColor: !!canFlipColor?.(r, c),
          cursors: cursorsByCell.get(cellKey) || [],
          pings: pingsByCell.get(cellKey) || [],
          highlighted: isHighlighted,
          myColor,
          frozen,
          pickupType: pickupsByCell.get(cellKey)?.type,
          cellStyle,
          // Explicitly pass through good and bad flags for visual feedback
          good: cell.good,
          bad: cell.bad,
        };
      })
    );
  }, [
    gridData,
    cols,
    size,
    selected.r,
    selected.c,
    direction,
    selectedParent,
    selectedIsWhite,
    circlesSet,
    shadesSet,
    cursorsByCell,
    pingsByCell,
    pickupsByCell,
    opponentGrid,
    solution,
    opponentGridData,
    references,
    myColor,
    frozen,
    canFlipColor,
    cellStyle,
    grid, // Needed because we use grid.getParent() inside the useMemo
  ]);

  const handleClick = useCallback((r: number, c: number) => {
    if (!grid.isWhite(r, c) && !editMode) return;
    if (r === selected.r && c === selected.c) {
      onChangeDirection();
    } else {
      onSetSelected({r, c});
    }
  }, [grid, editMode, selected.r, selected.c, onChangeDirection, onSetSelected]);

  const handleRightClick = useCallback((r: number, c: number) => {
    if (onPing) {
      onPing(r, c);
    }
  }, [onPing]);

  return (
    <table
      style={{
        width: cols * size,
        height: gridData.length * size,
      }}
      className={`grid ${sizeClass}`}
    >
      <tbody>
        {data.map((row, i) => (
          <RerenderBoundary
            name={`grid row ${i}`}
            key={i}
            hash={hashGridRow(row, {...cellStyle, size})}
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
                    onFlipColor={onFlipColor}
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
