import './css/listView.css';

import _ from 'lodash';
import React from 'react';
import GridWrapper from '../../lib/wrappers/GridWrapper';
import {toCellIndex} from '../../shared/types';
import Cell from '../Grid/Cell';
import {GridProps} from '../Grid/Grid';
import {hashGridRow} from '../Grid/hashGridRow';
import {ClueCoords, EnhancedGridData} from '../Grid/types';
import RerenderBoundary from '../RerenderBoundary';
import Clue from '../Player/ClueText';
import {lazy} from '../../lib/jsUtils';

interface ListViewProps extends GridProps {
  clues: {across: string[]; down: string[]};
  isClueSelected: (dir: 'across' | 'down', i: number) => boolean;
  selectClue: (dir: 'across' | 'down', i: number) => void;
}

function getSizeClass(size: number) {
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
}

function scrollToClue(dir: 'across' | 'down', num: number, el: any) {
  if (el) {
    lazy(`scrollToClue${dir}${num}`, () => {
      const parent = el.offsetParent;
      if (parent) {
        parent.scrollTop = el.offsetTop - parent.offsetHeight * 0.2;
      }
    });
  }
}

export default class ListView extends React.PureComponent<ListViewProps> {
  get grid() {
    return new GridWrapper(this.props.grid);
  }

  get opponentGrid() {
    return this.props.opponentGrid && new GridWrapper(this.props.opponentGrid);
  }

  get selectedIsWhite() {
    const {selected} = this.props;
    return this.grid.isWhite(selected.r, selected.c);
  }

  isSelected(r: number, c: number, dir: 'across' | 'down' = this.props.direction) {
    const {selected, direction} = this.props;
    return r === selected.r && c === selected.c && dir === direction;
  }

  isCircled(r: number, c: number) {
    const {grid, circles} = this.props;
    const idx = toCellIndex(r, c, grid[0].length);
    return (circles || []).indexOf(idx) !== -1;
  }

  isDoneByOpponent(r: number, c: number) {
    if (!this.opponentGrid || !this.props.solution) {
      return false;
    }
    return (
      this.opponentGrid.isFilled(r, c) && this.props.solution[r][c] === this.props.opponentGrid[r][c].value
    );
  }

  isShaded(r: number, c: number) {
    const {grid, shades} = this.props;
    const idx = toCellIndex(r, c, grid[0].length);
    return (shades || []).indexOf(idx) !== -1 || this.isDoneByOpponent(r, c);
  }

  isHighlighted(r: number, c: number, dir: 'across' | 'down' = this.props.direction) {
    if (!this.selectedIsWhite) return false;
    const {selected, direction} = this.props;
    const selectedParent = this.grid.getParent(selected.r, selected.c, direction);
    return (
      !this.isSelected(r, c, dir) &&
      this.grid.isWhite(r, c) &&
      this.grid.getParent(r, c, direction) === selectedParent &&
      direction === dir
    );
  }

  isReferenced(r: number, c: number, dir: 'across' | 'down') {
    return this.props.references.some((clue) => this.clueContainsSquare(clue, r, c, dir));
  }

  getPickup(r: number, c: number) {
    return (
      this.props.pickups &&
      _.get(
        _.find(this.props.pickups, ({i, j, pickedUp}) => i === r && j === c && !pickedUp),
        'type'
      )
    );
  }

  handleClick = (r: number, c: number, dir: 'across' | 'down') => {
    if (!this.grid.isWhite(r, c) && !this.props.editMode) return;
    if (dir !== this.props.direction) {
      this.props.onChangeDirection();
    }
    this.props.onSetSelected({r, c});
  };

  handleClickAcross = (r: number, c: number) => {
    this.handleClick(r, c, 'across');
  };

  handleClickDown = (r: number, c: number) => {
    this.handleClick(r, c, 'down');
  };

  handleRightClick = (r: number, c: number) => {
    this.props.onPing && this.props.onPing(r, c);
  };

  handleClueClick = (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    const {dir, clueidx} = (e.currentTarget as HTMLElement).dataset;
    if (dir && clueidx) {
      this.props.selectClue(dir as 'across' | 'down', Number(clueidx));
    }
  };

  handleClueKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      this.handleClueClick(e);
    }
  };

  clueContainsSquare({ori, num}: ClueCoords, r: number, c: number, dir: 'across' | 'down') {
    return this.grid.isWhite(r, c) && this.grid.getParent(r, c, ori) === num && ori === dir;
  }

  mapGridToClues() {
    const cluesCells = {across: [] as EnhancedGridData, down: [] as EnhancedGridData};
    this.props.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const enhancedCell = {
          ...cell,
          r,
          c,
          number: undefined,
          solvedByIconSize: Math.round(this.props.size / 10),
          selected: false,
          highlighted: false,
          referenced: false,
          circled: this.isCircled(r, c),
          shaded: this.isShaded(r, c),
          canFlipColor: !!this.props.canFlipColor?.(r, c),
          cursors: (this.props.cursors || []).filter((cursor) => cursor.r === r && cursor.c === c),
          pings: (this.props.pings || []).filter((ping) => ping.r === r && ping.c === c),

          myColor: this.props.myColor,
          frozen: this.props.frozen,
          pickupType: this.getPickup(r, c),
          cellStyle: this.props.cellStyle,
        };
        if (_.isNumber(cell.parents?.across)) {
          const acrossIdx = cell.parents?.across as number;
          cluesCells.across[acrossIdx] = cluesCells.across[acrossIdx] || [];
          cluesCells.across[acrossIdx].push({
            ...enhancedCell,
            selected: this.isSelected(r, c, 'across'),
            highlighted: this.isHighlighted(r, c, 'across'),
            referenced: this.isReferenced(r, c, 'across'),
          });
        }
        if (_.isNumber(cell.parents?.down)) {
          const downIdx = cell.parents?.down as number;
          cluesCells.down[downIdx] = cluesCells.down[downIdx] || [];
          cluesCells.down[downIdx].push({
            ...enhancedCell,
            selected: this.isSelected(r, c, 'down'),
            highlighted: this.isHighlighted(r, c, 'down'),
            referenced: this.isReferenced(r, c, 'down'),
          });
        }
      });
    });

    return cluesCells;
  }

  render() {
    const {size, clues} = this.props;
    const sizeClass = getSizeClass(size);

    const cluesCells = this.mapGridToClues();

    return (
      <div className="list-view">
        <div className="list-view--scroll">
          {(['across', 'down'] as ('across' | 'down')[]).map((dir) => (
            <div className="list-view--list" key={dir}>
              <div className="list-view--list--title">{dir.toUpperCase()}</div>
              {clues[dir].map(
                (clue, clueIdx) =>
                  clue && (
                    <div
                      className="list-view--list--clue"
                      // eslint-disable-next-line react/no-array-index-key
                      key={clueIdx}
                      // eslint-disable-next-line react/jsx-no-bind
                      ref={
                        this.props.isClueSelected(dir, clueIdx)
                          ? (el: any) => scrollToClue(dir, clueIdx, el)
                          : null
                      }
                      data-dir={dir}
                      data-clueidx={clueIdx}
                      role="button"
                      tabIndex={0}
                      onClick={this.handleClueClick}
                      onKeyDown={this.handleClueKeyDown}
                    >
                      <div className="list-view--list--clue--number">{clueIdx}</div>
                      <div className="list-view--list--clue--text">
                        <Clue text={clue} />
                      </div>
                      <div className="list-view--list--clue--break" />
                      <div className="list-view--list--clue--grid">
                        <table className={`grid ${sizeClass}`}>
                          <tbody>
                            <RerenderBoundary
                              name={`${dir} clue ${clueIdx}`}
                              // eslint-disable-next-line react/no-array-index-key
                              key={clueIdx}
                              hash={hashGridRow(cluesCells[dir][clueIdx], {
                                ...this.props.cellStyle,
                                size: this.props.size,
                              })}
                            >
                              <tr>
                                {cluesCells[dir][clueIdx].map((cellProps) => (
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
                                      // eslint-disable-next-line react/jsx-props-no-spreading
                                      {...cellProps}
                                      onClick={
                                        dir === 'across' ? this.handleClickAcross : this.handleClickDown
                                      }
                                      onContextMenu={this.handleRightClick}
                                      onFlipColor={this.props.onFlipColor}
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
  }
}
