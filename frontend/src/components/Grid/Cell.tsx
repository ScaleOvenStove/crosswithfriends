import powerups from '@crosswithfriends/shared/lib/powerups';
import {Tooltip} from '@mui/material';
import classNames from 'classnames';
import React, {useCallback} from 'react';

const isEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
  }
  return true;
};

const omit = <T extends Record<string, any>, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> => {
  const result = {...obj};
  for (const key of keys) {
    delete result[key];
  }
  return result;
};

const some = <T,>(arr: T[], fn: (item: T) => boolean): boolean => arr.some(fn);

import {logger} from '../../utils/logger';
import Emoji from '../common/Emoji';

import type {EnhancedCellData} from './types';

import './css/cell.css';

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
            className={classNames('cell--cursor', {
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
            className={classNames('cell--ping', {
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

  const handleFlipClick = useCallback(
    (e: React.MouseEvent) => {
      const {onFlipColor, r, c} = props;
      e.stopPropagation();
      onFlipColor?.(r, c);
    },
    [props]
  );

  const renderFlipButton = () => {
    const {canFlipColor} = props;
    if (canFlipColor) {
      return <i className="cell--flip fa fa-small fa-sticky-note" onClick={handleFlipClick} />;
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

  const handleClick = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    (e) => {
      e.preventDefault?.();
      props.onClick(props.r, props.c);
    },
    [props]
  );

  const handleRightClick = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    (e) => {
      e.preventDefault?.();
      props.onContextMenu(props.r, props.c);
    },
    [props]
  );

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
        className={classNames('cell', {
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
      className={classNames('cell', {
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
          className={classNames('cell--number', {
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
  if (!isEqual(omit(nextProps, ...pathsToOmit), omit(prevProps, ...pathsToOmit))) {
    logger.debug('Cell update', {
      // @ts-expect-error - lodash filter with dynamic keys
      changedKeys: Object.keys(prevProps).filter((k) => prevProps[k] !== nextProps[k]),
      row: nextProps.r,
      col: nextProps.c,
    });
    return false;
  }
  if (some(pathsToOmit, (p) => JSON.stringify(nextProps[p]) !== JSON.stringify(prevProps[p]))) {
    logger.debug('Cell update for array', {row: nextProps.r, col: nextProps.c});
    return false;
  }
  return true;
};

export default React.memo(Cell, areEqual);
