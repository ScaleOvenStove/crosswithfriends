/* eslint react/no-string-refs: "warn", no-plusplus: "off" */
import './css/gridControls.css';

import React, {useEffect, useCallback} from 'react';

import {useGridControls, GridControlsActions} from './useGridControls';

interface GridControlsProps {
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
  children?: React.ReactNode;
  actions?: Partial<GridControlsActions>;
}

const GridControls: React.FC<GridControlsProps> = (props) => {
  const {
    inputRef,
    focus,
    handleKeyDown: handleKeyDownInternal,
    handleKeyDownVim,
  } = useGridControls(props, props.actions);

  useEffect(() => {
    focus();
  }, [focus]);

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      focus();
    },
    [focus]
  );

  const handleKeyDown = useCallback(
    (ev: KeyboardEvent | React.KeyboardEvent) => {
      const _handleKeyDown = props.vimMode ? handleKeyDownVim : handleKeyDownInternal;
      const target = ev.target as HTMLElement;
      if (
        target !== inputRef.current &&
        (target.tagName === 'INPUT' || (ev as any).metaKey || (ev as any).ctrlKey)
      ) {
        return;
      }
      if (_handleKeyDown(ev.key, (ev as any).shiftKey, (ev as any).altKey)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    [props.vimMode, handleKeyDownInternal, handleKeyDownVim, inputRef]
  );

  const gridProps = {
    style: {
      touchAction: 'manipulation' as const,
    },
  };
  const inputProps = {
    style: {
      opacity: 0,
      width: 0,
      height: 0,
    },
    autoComplete: 'none' as const,
    autoCapitalize: 'none' as const,
  };

  return (
    <div
      className="grid-controls"
      tabIndex={1}
      onClick={handleClick}
      onKeyDown={handleKeyDown as any}
      {...gridProps}
    >
      <div className="grid--content">{props.children}</div>
      <input tabIndex={-1} name="grid" ref={inputRef} {...inputProps} />
    </div>
  );
};

export default GridControls;
