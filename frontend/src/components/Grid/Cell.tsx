import React from 'react';
import * as _ from 'lodash';
import clsx from 'clsx';
import {Tooltip} from '@mui/material';
import Emoji from '../common/Emoji';
import powerups from '@crosswithfriends/shared/lib/powerups';
import {Ping, CellStyles} from './types';
import './css/cell.css';
import {CellData, Cursor} from '@crosswithfriends/shared/types';

export interface EnhancedCellData extends CellData {
  r: number;
  c: number;

  // Player interactions
  cursors: Cursor[];
  pings: Ping[];
  solvedByIconSize: number;

  // Cell states
  selected: boolean;
  highlighted: boolean;
  frozen: boolean;
  circled: boolean;
  shaded: boolean;
  referenced: boolean;
  canFlipColor: boolean;
  pickupType: keyof typeof powerups;

  // Styles
  attributionColor: string;
  cellStyle: CellStyles;
  myColor: string;
}

interface Props extends EnhancedCellData {
  // Callbacks
  onClick: (r: number, c: number) => void;
  onContextMenu: (r: number, c: number) => void;
  onFlipColor?: (r: number, c: number) => void;
}

/**
 * Renders a single cell in the crossword grid.
 * Handles cell states (selected, highlighted, frozen, etc.), cursors, pings, and user interactions.
 *
 * @example
 * ```tsx
 * <Cell
 *   r={0}
 *   c={0}
 *   value="A"
 *   selected={true}
 *   onClick={handleClick}
 *   onContextMenu={handleRightClick}
 *   {...otherProps}
 * />
 * ```
 */
const Cell: React.FC<Props> = (props) => {
  const renderCursors = () => {
    const {cursors} = props;
    return (
      <div className="cell--cursors">
        {cursors.map(({color, active}, i) => (
          <div
            key={i}
            className={clsx('cell--cursor', {
              active,
              inactive: !active,
            })}
            style={{
              borderColor: color,
              zIndex: Math.min(2 + cursors.length - i, 9),
              borderWidth: Math.min(1 + 2 * (i + 1), 12),
            }}
          />
        ))}
      </div>
    );
  };

  const renderPings = () => {
    const {pings} = props;
    return (
      <div className="cell--pings">
        {pings.map(({color, active}, i) => (
          <div
            key={i}
            className={clsx('cell--ping', {
              active,
              inactive: !active,
            })}
            style={{
              borderColor: color,
              zIndex: Math.min(2 + pings.length - i, 9),
            }}
          />
        ))}
      </div>
    );
  };

  const renderFlipButton = () => {
    const {canFlipColor, onFlipColor, r, c} = props;
    if (canFlipColor) {
      return (
        <i
          className="cell--flip fa fa-small fa-sticky-note"
          onClick={(e) => {
            e.stopPropagation();
            onFlipColor?.(r, c);
          }}
        />
      );
    }
    return null;
  };

  const renderCircle = () => {
    const {circled} = props;
    if (circled) {
      return <div className="cell--circle" />;
    }
    return null;
  };

  const renderShade = () => {
    const {shaded} = props;
    if (shaded) {
      return <div className="cell--shade" />;
    }
    return null;
  };

  const renderPickup = () => {
    const {pickupType} = props;
    if (pickupType) {
      const {icon} = powerups[pickupType];
      return <Emoji emoji={icon} big={false} />;
    }
    return null;
  };

  const renderSolvedBy = () => {
    const {solvedBy, solvedByIconSize} = props;
    if (!solvedBy) return null;
    const divStyle: React.CSSProperties = {
      width: solvedByIconSize! * 2,
      height: solvedByIconSize! * 2,
      borderRadius: solvedByIconSize!,
      backgroundColor: solvedBy?.teamId === 1 ? '#FA8072' : 'purple',
      // transform: 'translateX(-0.5px)',
      position: 'absolute',
      right: 1,
    };
    return <div style={divStyle} />;
  };

  const getStyle = () => {
    const {attributionColor, cellStyle, selected, highlighted, frozen} = props;
    if (selected) {
      return cellStyle.selected;
    }
    if (highlighted) {
      if (frozen) {
        return cellStyle.frozen;
      }
      return cellStyle.highlighted;
    }
    return {backgroundColor: attributionColor};
  };

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault?.();
    props.onClick(props.r, props.c);
  };

  const handleRightClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault?.();
    props.onContextMenu(props.r, props.c);
  };

  const {
    black,
    isHidden,
    selected,
    highlighted,
    shaded,
    bad,
    good,
    revealed,
    pencil,
    value,
    myColor,
    number,
    referenced,
    frozen,
    cursors,
  } = props;

  if (black || isHidden) {
    return (
      <div
        className={clsx('cell', {
          selected,
          black,
          hidden: isHidden,
        })}
        style={selected ? {borderColor: myColor} : undefined}
        onClick={handleClick}
        onContextMenu={handleRightClick}
      >
        {renderPings()}
      </div>
    );
  }

  const val = value || '';
  const l = Math.max(1, val.length);
  const displayNames = cursors.map((cursor) => cursor.displayName).join(', ');
  const style = getStyle();

  const cellContent = (
    <div
      className={clsx('cell', {
        selected,
        highlighted,
        referenced,
        shaded,
        bad,
        good,
        revealed,
        pencil,
        frozen,
      })}
      style={style}
      onClick={handleClick}
      onContextMenu={handleRightClick}
    >
      <div className="cell--wrapper">
        <div
          className={clsx('cell--number', {
            nonempty: !!number,
          })}
        >
          {number}
        </div>
        {renderFlipButton()}
        {renderCircle()}
        {renderShade()}
        {renderPickup()}
        {renderSolvedBy()}
        <div
          className="cell--value"
          style={{
            fontSize: `${350 / Math.sqrt(l)}%`,
            lineHeight: `${Math.sqrt(l) * 98}%`,
          }}
        >
          {val}
        </div>
      </div>
      {renderCursors()}
      {renderPings()}
    </div>
  );

  // Only wrap with Tooltip if there are cursors to display
  // Material-UI Tooltip requires a non-empty title
  if (displayNames && displayNames.trim()) {
    return <Tooltip title={displayNames}>{cellContent}</Tooltip>;
  }

  return cellContent;
};

// Custom comparison function to replicate shouldComponentUpdate logic
const areEqual = (prevProps: Props, nextProps: Props) => {
  const pathsToOmit = ['cursors', 'pings', 'cellStyle'] as const;
  if (!_.isEqual(_.omit(nextProps, ...pathsToOmit), _.omit(prevProps, ...pathsToOmit))) {
    console.debug(
      'cell update',
      // @ts-ignore
      _.filter(_.keys(prevProps), (k) => prevProps[k] !== nextProps[k])
    );
    return false;
  }
  if (_.some(pathsToOmit, (p) => JSON.stringify(nextProps[p]) !== JSON.stringify(prevProps[p]))) {
    console.debug('cell update for array');
    return false;
  }
  return true;
};

export default React.memo(Cell, areEqual);
