import './css/index.css';

import React, {useMemo} from 'react';
import GridWrapper from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import RerenderBoundary from '../RerenderBoundary';
import {hashGridRow} from './hashGridRow';
import Cell from './Cell';
import type {GridDataWithColor, CellCoords, ClueCoords, BattlePickup, CellStyles, Ping} from './types';
import {toCellIndex} from '@crosswithfriends/shared/types';
import type {CellIndex, Cursor, GridData} from '@crosswithfriends/shared/types';

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

  // Use Sets for O(1) lookups instead of O(n) indexOf
  const circlesSet = useMemo(() => {
    return new Set(props.circles || []);
  }, [props.circles]);

  const shadesSet = useMemo(() => {
    return new Set(props.shades || []);
  }, [props.shades]);

  // Index cursors and pings by cell for faster lookup
  const cursorsByCell = useMemo(() => {
    const map = new Map<string, Cursor[]>();
    (props.cursors || []).forEach((cursor) => {
      const key = `${cursor.r},${cursor.c}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(cursor);
    });
    return map;
  }, [props.cursors]);

  const pingsByCell = useMemo(() => {
    const map = new Map<string, Ping[]>();
    (props.pings || []).forEach((ping) => {
      const key = `${ping.r},${ping.c}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(ping);
    });
    return map;
  }, [props.pings]);

  // Index pickups by cell
  const pickupsByCell = useMemo(() => {
    const map = new Map<string, BattlePickup>();
    (props.pickups || []).forEach((pickup) => {
      if (!pickup.pickedUp) {
        const key = `${pickup.i},${pickup.j}`;
        map.set(key, pickup);
      }
    });
    return map;
  }, [props.pickups]);

  const {size, cellStyle, selected, direction} = props;
  const cols = props.grid[0].length;

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
    return props.grid.map((row, r) =>
      row.map((cell, c) => {
        const cellKey = `${r},${c}`;
        const cellIdx = toCellIndex(r, c, cols);
        const isCellSelected = r === selected.r && c === selected.c;
        const isCellWhite = !cell.black;

        // Check if done by opponent
        const isDoneByOpp = opponentGrid
          ? opponentGrid.isFilled(r, c) && props.solution[r]?.[c] === props.opponentGrid[r]?.[c]?.value
          : false;

        // Check if highlighted (same word as selected)
        const isHighlighted =
          selectedIsWhite &&
          isCellWhite &&
          !isCellSelected &&
          grid.getParent(r, c, direction) === selectedParent;

        // Check if referenced
        const isReferenced = props.references.some(
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
          canFlipColor: !!props.canFlipColor?.(r, c),
          cursors: cursorsByCell.get(cellKey) || [],
          pings: pingsByCell.get(cellKey) || [],
          highlighted: isHighlighted,
          myColor: props.myColor,
          frozen: props.frozen,
          pickupType: pickupsByCell.get(cellKey)?.type,
          cellStyle,
        };
      })
    );
  }, [
    props.grid,
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
    props.solution,
    props.opponentGrid,
    props.references,
    props.myColor,
    props.frozen,
    props.canFlipColor,
    cellStyle,
    grid, // Needed because we use grid.getParent() inside the useMemo
  ]);

  const handleClick = (r: number, c: number) => {
    if (!grid.isWhite(r, c) && !props.editMode) return;
    if (r === selected.r && c === selected.c) {
      props.onChangeDirection();
    } else {
      props.onSetSelected({r, c});
    }
  };

  const handleRightClick = (r: number, c: number) => {
    if (props.onPing) {
      props.onPing(r, c);
    }
  };

  return (
    <table
      style={{
        width: cols * size,
        height: props.grid.length * size,
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
