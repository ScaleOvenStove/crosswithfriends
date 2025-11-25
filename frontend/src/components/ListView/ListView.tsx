import './css/listView.css';

import {lazy} from '@crosswithfriends/shared/lib/jsUtils';
import GridWrapper from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import {toCellIndex} from '@crosswithfriends/shared/types';
import React, {useMemo, useCallback} from 'react';

import Cell from '../Grid/Cell';
import type {GridProps} from '../Grid/Grid';
import {hashGridRow} from '../Grid/hashGridRow';
import type {ClueCoords, EnhancedGridData} from '../Grid/types';
import Clue from '../Player/ClueText';
import RerenderBoundary from '../RerenderBoundary';

interface ListViewProps extends GridProps {
  clues: {across: string[]; down: string[]};
  isClueSelected: (dir: 'across' | 'down', i: number) => boolean;
  selectClue: (dir: 'across' | 'down', i: number) => void;
}

const ListView: React.FC<ListViewProps> = (props) => {
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
    clues,
    isClueSelected,
    selectClue,
  } = props;

  const grid = useMemo(() => new GridWrapper(gridData), [gridData]);

  const opponentGrid = useMemo(() => {
    return opponentGridData ? new GridWrapper(opponentGridData) : null;
  }, [opponentGridData]);

  const selectedIsWhite = useMemo(() => {
    return grid.isWhite(selected.r, selected.c);
  }, [grid, selected]);

  const isSelected = useCallback(
    (r: number, c: number, dir: 'across' | 'down' = direction) => {
      return r === selected.r && c === selected.c && dir === direction;
    },
    [selected, direction]
  );

  const isCircled = useCallback(
    (r: number, c: number) => {
      const idx = toCellIndex(r, c, gridData[0].length);
      return (circles || []).indexOf(idx) !== -1;
    },
    [gridData, circles]
  );

  const isDoneByOpponent = useCallback(
    (r: number, c: number) => {
      if (!opponentGrid || !solution) {
        return false;
      }
      return opponentGrid.isFilled(r, c) && solution[r][c] === opponentGridData![r][c].value;
    },
    [opponentGrid, solution, opponentGridData]
  );

  const isShaded = useCallback(
    (r: number, c: number) => {
      const idx = toCellIndex(r, c, gridData[0].length);
      return (shades || []).indexOf(idx) !== -1 || isDoneByOpponent(r, c);
    },
    [gridData, shades, isDoneByOpponent]
  );

  const isHighlighted = useCallback(
    (r: number, c: number, dir: 'across' | 'down' = direction) => {
      if (!selectedIsWhite) return false;
      const selectedParent = grid.getParent(selected.r, selected.c, direction);
      return (
        !isSelected(r, c, dir) &&
        grid.isWhite(r, c) &&
        grid.getParent(r, c, dir) === selectedParent &&
        dir === direction
      );
    },
    [selectedIsWhite, grid, selected, direction, isSelected]
  );

  const clueContainsSquare = useCallback(
    ({ori, num}: ClueCoords, r: number, c: number, dir: 'across' | 'down') => {
      return grid.isWhite(r, c) && grid.getParent(r, c, ori) === num && ori === dir;
    },
    [grid]
  );

  const isReferenced = useCallback(
    (r: number, c: number, dir: 'across' | 'down') => {
      return references.some((clue) => clueContainsSquare(clue, r, c, dir));
    },
    [references, clueContainsSquare]
  );

  const getPickup = useCallback(
    (r: number, c: number) => {
      return pickups && pickups.find(({i, j, pickedUp}) => i === r && j === c && !pickedUp)?.type;
    },
    [pickups]
  );

  const handleClick = useCallback(
    (r: number, c: number, dir: 'across' | 'down') => {
      if (!grid.isWhite(r, c) && !editMode) return;
      if (dir !== direction) {
        onChangeDirection();
      }
      onSetSelected({r, c});
    },
    [grid, editMode, direction, onChangeDirection, onSetSelected]
  );

  const handleRightClick = useCallback(
    (r: number, c: number) => {
      if (onPing) {
        onPing(r, c);
      }
    },
    [onPing]
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

  const scrollToClue = useCallback((dir: 'across' | 'down', num: number, el: HTMLElement | null) => {
    if (el) {
      lazy(`scrollToClue${dir}${num}`, () => {
        const parent = el.offsetParent;
        if (parent) {
          parent.scrollTop = el.offsetTop - parent.offsetHeight * 0.2;
        }
      });
    }
  }, []);

  const mapGridToClues = useCallback(() => {
    const cluesCells: {across: EnhancedGridData[]; down: EnhancedGridData[]} = {across: [], down: []};
    gridData.forEach((row, r) => {
      row.forEach((cell, c) => {
        const enhancedCell = {
          ...cell,
          r,
          c,
          number: undefined,
          solvedByIconSize: Math.round(size / 10),
          selected: false,
          highlighted: false,
          referenced: false,
          circled: isCircled(r, c),
          shaded: isShaded(r, c),
          canFlipColor: !!canFlipColor?.(r, c),
          cursors: (cursors || []).filter((cursor) => cursor.r === r && cursor.c === c),
          pings: (pings || []).filter((ping) => ping.r === r && ping.c === c),

          myColor,
          frozen,
          pickupType: getPickup(r, c),
          cellStyle,
        };
        if (typeof cell.parents?.across === 'number') {
          const acrossIdx = cell.parents?.across as number;
          cluesCells.across[acrossIdx] = cluesCells.across[acrossIdx] || [];
          cluesCells.across[acrossIdx].push({
            ...enhancedCell,
            selected: isSelected(r, c, 'across'),
            highlighted: isHighlighted(r, c, 'across'),
            referenced: isReferenced(r, c, 'across'),
          });
        }
        if (typeof cell.parents?.down === 'number') {
          const downIdx = cell.parents?.down as number;
          cluesCells.down[downIdx] = cluesCells.down[downIdx] || [];
          cluesCells.down[downIdx].push({
            ...enhancedCell,
            selected: isSelected(r, c, 'down'),
            highlighted: isHighlighted(r, c, 'down'),
            referenced: isReferenced(r, c, 'down'),
          });
        }
      });
    });

    return cluesCells;
  }, [
    gridData,
    size,
    isCircled,
    isShaded,
    canFlipColor,
    cursors,
    pings,
    myColor,
    frozen,
    getPickup,
    cellStyle,
    isSelected,
    isHighlighted,
    isReferenced,
  ]);

  const sizeClass = getSizeClass(size);
  const cluesCells = mapGridToClues();

  return (
    <div className="list-view">
      <div className="list-view--scroll">
        {(['across', 'down'] as ('across' | 'down')[]).map((dir, i) => (
          <div className="list-view--list" key={i}>
            <div className="list-view--list--title">{dir.toUpperCase()}</div>
            {clues[dir].map(
              (clue, idx) =>
                clue && (
                  <div
                    className="list-view--list--clue"
                    key={idx}
                    ref={isClueSelected(dir, idx) ? (el) => scrollToClue(dir, idx, el) : null}
                    onClick={() => selectClue(dir, idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectClue(dir, idx);
                      }
                    }}
                  >
                    <div className="list-view--list--clue--number">{idx}</div>
                    <div className="list-view--list--clue--text">
                      <Clue text={clue} />
                    </div>
                    <div className="list-view--list--clue--break"></div>
                    <div className="list-view--list--clue--grid">
                      <table className={`grid ${sizeClass}`}>
                        <tbody>
                          <RerenderBoundary
                            name={`${dir} clue ${idx}`}
                            key={idx}
                            hash={hashGridRow(cluesCells[dir][idx], {
                              ...cellStyle,
                              size,
                            })}
                          >
                            <tr>
                              {cluesCells[dir][idx].map((cellProps) => (
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
                                    onClick={handleClick.bind(null, cellProps.r, cellProps.c, dir) as any}
                                    onContextMenu={handleRightClick}
                                    onFlipColor={onFlipColor}
                                  />
                                </td>
                              ))}
                            </tr>
                          </RerenderBoundary>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(ListView);
