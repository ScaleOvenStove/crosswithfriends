import './css/listView.css';

import _ from 'lodash';
import React, {useMemo, useCallback} from 'react';
import GridWrapper from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import {toCellIndex} from '@crosswithfriends/shared/types';
import Cell from '../Grid/Cell';
import {GridProps} from '../Grid/Grid';
import {hashGridRow} from '../Grid/hashGridRow';
import {ClueCoords, EnhancedGridData} from '../Grid/types';
import RerenderBoundary from '../RerenderBoundary';
import Clue from '../Player/ClueText';
import {lazy} from '@crosswithfriends/shared/lib/jsUtils';

interface ListViewProps extends GridProps {
  clues: {across: string[]; down: string[]};
  isClueSelected: (dir: 'across' | 'down', i: number) => boolean;
  selectClue: (dir: 'across' | 'down', i: number) => void;
}

const ListView: React.FC<ListViewProps> = (props) => {
  const grid = useMemo(() => new GridWrapper(props.grid), [props.grid]);

  const opponentGrid = useMemo(() => {
    return props.opponentGrid ? new GridWrapper(props.opponentGrid) : null;
  }, [props.opponentGrid]);

  const selectedIsWhite = useMemo(() => {
    return grid.isWhite(props.selected.r, props.selected.c);
  }, [grid, props.selected]);

  const isSelected = useCallback(
    (r: number, c: number, dir: 'across' | 'down' = props.direction) => {
      return r === props.selected.r && c === props.selected.c && dir === props.direction;
    },
    [props.selected, props.direction]
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
      return opponentGrid.isFilled(r, c) && props.solution[r][c] === props.opponentGrid![r][c].value;
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
    (r: number, c: number, dir: 'across' | 'down' = props.direction) => {
      if (!selectedIsWhite) return false;
      const selectedParent = grid.getParent(props.selected.r, props.selected.c, props.direction);
      return (
        !isSelected(r, c, dir) &&
        grid.isWhite(r, c) &&
        grid.getParent(r, c, dir) === selectedParent &&
        dir === props.direction
      );
    },
    [selectedIsWhite, grid, props.selected, props.direction, isSelected]
  );

  const isReferenced = useCallback(
    (r: number, c: number, dir: 'across' | 'down') => {
      return props.references.some((clue) => clueContainsSquare(clue, r, c, dir));
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

  const handleClick = useCallback(
    (r: number, c: number, dir: 'across' | 'down') => {
      if (!grid.isWhite(r, c) && !props.editMode) return;
      if (dir !== props.direction) {
        props.onChangeDirection();
      }
      props.onSetSelected({r, c});
    },
    [grid, props.editMode, props.direction, props.onChangeDirection, props.onSetSelected]
  );

  const handleRightClick = useCallback(
    (r: number, c: number) => {
      if (props.onPing) {
        props.onPing(r, c);
      }
    },
    [props.onPing]
  );

  const clueContainsSquare = useCallback(
    ({ori, num}: ClueCoords, r: number, c: number, dir: 'across' | 'down') => {
      return grid.isWhite(r, c) && grid.getParent(r, c, ori) === num && ori === dir;
    },
    [grid]
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
    props.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const enhancedCell = {
          ...cell,
          r,
          c,
          number: undefined,
          solvedByIconSize: Math.round(props.size / 10),
          selected: false,
          highlighted: false,
          referenced: false,
          circled: isCircled(r, c),
          shaded: isShaded(r, c),
          canFlipColor: !!props.canFlipColor?.(r, c),
          cursors: (props.cursors || []).filter((cursor) => cursor.r === r && cursor.c === c),
          pings: (props.pings || []).filter((ping) => ping.r === r && ping.c === c),

          myColor: props.myColor,
          frozen: props.frozen,
          pickupType: getPickup(r, c),
          cellStyle: props.cellStyle,
        };
        if (_.isNumber(cell.parents?.across)) {
          const acrossIdx = cell.parents?.across as number;
          cluesCells.across[acrossIdx] = cluesCells.across[acrossIdx] || [];
          cluesCells.across[acrossIdx].push({
            ...enhancedCell,
            selected: isSelected(r, c, 'across'),
            highlighted: isHighlighted(r, c, 'across'),
            referenced: isReferenced(r, c, 'across'),
          });
        }
        if (_.isNumber(cell.parents?.down)) {
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
  }, [props, isCircled, isShaded, getPickup, isSelected, isHighlighted, isReferenced]);

  const {size, clues} = props;
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
                    ref={props.isClueSelected(dir, idx) ? (el) => scrollToClue(dir, idx, el) : null}
                    onClick={() => props.selectClue(dir, idx)}
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
                              ...props.cellStyle,
                              size: props.size,
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
                                    onClick={(r, c) => handleClick(r, c, dir)}
                                    onContextMenu={handleRightClick}
                                    onFlipColor={props.onFlipColor}
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
