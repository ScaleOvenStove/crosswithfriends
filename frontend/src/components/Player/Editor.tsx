/* eslint react/no-string-refs: "warn" */
import './css/editor.css';
import * as gameUtils from '@crosswithfriends/shared/lib/gameUtils';
import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import type {Cursor, GridData} from '@crosswithfriends/shared/types';
import {Box, Stack} from '@mui/material';
import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';

import EditableSpan from '../common/EditableSpan';
import Hints from '../Compose/Hints';
import Grid from '../Grid';

import GridControls from './GridControls';

window.requestIdleCallback =
  window.requestIdleCallback ||
  function (cb) {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  };

window.cancelIdleCallback =
  window.cancelIdleCallback ||
  function (id) {
    clearTimeout(id);
  };

interface EditorProps {
  grid: GridData;
  clues: {across: string[]; down: string[]};
  size: number;
  cursors: Cursor[];
  myColor: string;
  onUpdateGrid: (r: number, c: number, value: string) => void;
  onUpdateClue: (r: number, c: number, direction: 'across' | 'down', value: string) => void;
  onUpdateCursor: (selected: {r: number; c: number}) => void;
  onChange: () => void;
  onFlipColor: (r: number, c: number) => void;
  onAutofill: () => void;
  onPublish: () => void;
  onChangeRows: (rows: number) => void;
  onChangeColumns: (columns: number) => void;
  onClearPencil: () => void;
  onUnfocus: () => void;
}

export type EditorRef = {
  focus: () => void;
  focusGrid: () => void;
  focusClue: () => void;
};

const Editor = forwardRef<EditorRef, EditorProps>((props, ref) => {
  // Destructure props to avoid dependency issues
  const {
    grid: gridData,
    clues,
    size,
    cursors,
    myColor,
    onUpdateGrid,
    onUpdateClue,
    onUpdateCursor,
    onChange,
    onFlipColor,
    onAutofill,
    onPublish,
    onChangeRows,
    onChangeColumns,
    onClearPencil,
    onUnfocus,
  } = props;

  const [selected, setSelected] = useState({r: 0, c: 0});
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [frozen, setFrozen] = useState(false);

  const gridControlsRef = useRef<{
    focus: () => void;
    selectClue: (direction: string, number: number) => void;
  } | null>(null);
  const clueRef = useRef<{focus: () => void} | null>(null);
  const prvNumRef = useRef<Record<string, number>>({});
  const prvIdleIDRef = useRef<Record<string, number>>({});
  const clueScrollRef = useRef<number>(0);

  const grid = useMemo(() => {
    const g = new GridObject(gridData);
    g.assignNumbers();
    return g;
  }, [gridData]);

  const focusGridRef = useRef<() => void>(() => {});
  const focusClueRef = useRef<() => void>(() => {});

  useImperativeHandle(ref, () => ({
    focus: () => {
      focusGridRef.current();
    },
    focusGrid: () => {
      focusGridRef.current();
    },
    focusClue: () => {
      focusClueRef.current();
    },
  }));

  const focusGrid = useCallback(() => {
    if (gridControlsRef.current) {
      gridControlsRef.current.focus();
    }
  }, []);

  useEffect(() => {
    focusGridRef.current = focusGrid;
  }, [focusGrid]);

  const focusClue = useCallback(() => {
    if (clueRef.current) {
      clueRef.current.focus();
    }
  }, []);

  useEffect(() => {
    focusClueRef.current = focusClue;
  }, [focusClue]);

  const canSetDirection = useCallback(() => true, []);

  const handleSetDirection = useCallback((dir: 'across' | 'down') => {
    setDirection(dir);
  }, []);

  const handleSetSelected = useCallback(
    (sel: {r: number; c: number}) => {
      setSelected(sel);
      onUpdateCursor(sel);
    },
    [onUpdateCursor]
  );

  const handleChangeDirection = useCallback(() => {
    setDirection((prevDir) => gameUtils.getOppositeDirection(prevDir));
  }, []);

  const handleSelectClue = useCallback((dir: 'across' | 'down', number: number) => {
    if (gridControlsRef.current) {
      gridControlsRef.current.selectClue(dir, number);
    }
  }, []);

  const handleUpdateGrid = useCallback(
    (r: number, c: number, value: string) => {
      onUpdateGrid(r, c, value);
      onChange();
    },
    [onUpdateGrid, onChange]
  );

  const handlePressPeriod = useCallback(() => {
    onFlipColor(selected.r, selected.c);
    onChange();
  }, [selected, onFlipColor, onChange]);

  const handleChangeRows = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeRows(Number(event.target.value));
    },
    [onChangeRows]
  );

  const handleChangeColumns = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeColumns(Number(event.target.value));
    },
    [onChangeColumns]
  );

  const handleToggleFreeze = useCallback(() => {
    setFrozen((prev) => !prev);
  }, []);

  const selectedIsWhite = useMemo(() => {
    return grid.isWhite(selected.r, selected.c);
  }, [grid, selected]);

  const selectedClueNumber = useMemo(() => {
    if (!selectedIsWhite) return undefined;
    return grid.getParent(selected.r, selected.c, direction);
  }, [selectedIsWhite, grid, selected, direction]);

  const halfSelectedClueNumber = useMemo(() => {
    if (!selectedIsWhite) return undefined;
    return grid.getParent(selected.r, selected.c, gameUtils.getOppositeDirection(direction));
  }, [selectedIsWhite, grid, selected, direction]);

  const selectedParent = useMemo(() => {
    if (!selectedIsWhite || selectedClueNumber === undefined) return undefined;
    return grid.getCellByNumber(selectedClueNumber);
  }, [selectedIsWhite, selectedClueNumber, grid]);

  const clueBarAbbreviation = useMemo(() => {
    if (!selectedIsWhite || selectedClueNumber === undefined) return undefined;
    return selectedClueNumber + direction.substr(0, 1).toUpperCase();
  }, [selectedIsWhite, selectedClueNumber, direction]);

  const handleChangeClue = useCallback(
    (value: string) => {
      if (selectedParent) {
        onUpdateClue(selectedParent.r, selectedParent.c, direction, value);
        onChange();
      }
    },
    [selectedParent, direction, onUpdateClue, onChange]
  );

  const isClueSelected = useCallback(
    (dir: 'across' | 'down', number: number) => {
      return dir === direction && number === selectedClueNumber;
    },
    [direction, selectedClueNumber]
  );

  const isClueHalfSelected = useCallback(
    (dir: 'across' | 'down', number: number) => {
      return dir !== direction && number === halfSelectedClueNumber;
    },
    [direction, halfSelectedClueNumber]
  );

  const _isSelected = useCallback(
    (r: number, c: number) => {
      return r === selected.r && c === selected.c;
    },
    [selected]
  );

  const scrollToClue = useCallback((dir: string, num: number, el: HTMLElement | null) => {
    if (el && prvNumRef.current[dir] !== num) {
      prvNumRef.current[dir] = num;
      if (prvIdleIDRef.current[dir]) {
        cancelIdleCallback(prvIdleIDRef.current[dir]);
      }
      prvIdleIDRef.current[dir] = requestIdleCallback(() => {
        if (clueScrollRef.current === el.offsetTop) return;
        const parent = el.offsetParent;
        if (parent) {
          parent.scrollTop = el.offsetTop - parent.offsetHeight * 0.4;
          clueScrollRef.current = el.offsetTop;
        }
      });
    }
  }, []);

  const renderClueList = useCallback(
    (dir: 'across' | 'down') => {
      return clues[dir].map(
        (clue, i) =>
          clue !== undefined && (
            <Box
              key={i}
              sx={{flexShrink: 0, display: 'flex'}}
              className={`${
                isClueSelected(dir, i) ? 'selected ' : isClueHalfSelected(dir, i) ? 'half-selected ' : ' '
              }editor--main--clues--list--scroll--clue`}
              ref={
                isClueSelected(dir, i) || isClueHalfSelected(dir, i) ? (el) => scrollToClue(dir, i, el) : null
              }
              onClick={() => {
                handleSelectClue(dir, i);
              }}
            >
              <Box
                className="editor--main--clues--list--scroll--clue--number"
                sx={{flexShrink: 0, display: 'flex'}}
              >
                {i}
              </Box>
              <Box
                className="editor--main--clues--list--scroll--clue--text"
                sx={{flexShrink: 1, display: 'flex'}}
              >
                {clue}
              </Box>
            </Box>
          )
      );
    },
    [clues, isClueSelected, isClueHalfSelected, scrollToClue, handleSelectClue]
  );

  return (
    <Box className="editor--main--wrapper" sx={{display: 'flex', flex: 1, minHeight: 0, height: '100%'}}>
      <GridControls
        ref={gridControlsRef}
        selected={selected}
        editMode
        frozen={frozen}
        direction={direction}
        canSetDirection={canSetDirection}
        onSetDirection={handleSetDirection}
        onSetSelected={handleSetSelected}
        onPressEnter={() => {
          focusClue();
        }}
        onPressEscape={() => onUnfocus()}
        onPressPeriod={handlePressPeriod}
        updateGrid={handleUpdateGrid}
        grid={gridData}
        clues={clues}
      >
        <Box className="editor--main" sx={{display: 'flex'}}>
          <div className="editor--main--left">
            <div className="editor--main--clue-bar">
              <div className="editor--main--clue-bar--number">{clueBarAbbreviation}</div>
              <div className="editor--main--clue-bar--text">
                <EditableSpan
                  ref={clueRef}
                  key_={`${direction}${selectedClueNumber}`}
                  value={clues[direction][selectedClueNumber || 0] || ''}
                  onChange={handleChangeClue}
                  onUnfocus={focusGrid}
                  hidden={!selectedIsWhite || selectedClueNumber === undefined}
                />
              </div>
            </div>

            <div className="editor--main--left--grid blurable">
              <Grid
                size={size}
                grid={gridData}
                cursors={cursors}
                selected={selected}
                direction={direction}
                onSetSelected={handleSetSelected}
                onChangeDirection={handleChangeDirection}
                myColor={myColor}
                references={[]}
                editMode
                cellStyle={{}}
                solution={[]}
                opponentGrid={[]}
                pings={[]}
                circles={[]}
                shades={[]}
                pickups={[]}
              />
            </div>
            <Box
              className="editor--button"
              sx={{display: 'flex', justifyContent: 'center'}}
              onClick={handleToggleFreeze}
            >
              {frozen ? 'Unfreeze Grid' : 'Freeze Grid'}
            </Box>
            <Box sx={{display: 'flex'}}>
              <Box
                className="editor--button"
                sx={{display: 'flex', justifyContent: 'center'}}
                onClick={onAutofill}
              >
                Autofill Grid
              </Box>
              <Box
                className="editor--button"
                sx={{display: 'flex', justifyContent: 'center'}}
                onClick={onClearPencil}
              >
                Clear Pencil
              </Box>
              <Box
                className="editor--button"
                sx={{display: 'flex', justifyContent: 'center'}}
                onClick={onPublish}
              >
                Publish
              </Box>
            </Box>
            <Box sx={{display: 'flex'}}>
              <Box className="editor--grid-size" sx={{display: 'flex'}}>
                {'Rows: '}
              </Box>
              <Box className="editor--grid-size" sx={{display: 'flex'}}>
                <input
                  className="editor--input"
                  type="number"
                  defaultValue={grid.size}
                  onChange={handleChangeRows}
                />
              </Box>
              <Box className="editor--grid-size" sx={{display: 'flex'}}>
                {'Columns: '}
              </Box>
              <Box className="editor--grid-size" sx={{display: 'flex'}}>
                <input
                  className="editor--input"
                  type="number"
                  defaultValue={grid.size}
                  onChange={handleChangeColumns}
                />
              </Box>
            </Box>
          </div>
          <Stack className="editor--right" direction="column" sx={{display: 'flex'}}>
            <Box className="editor--main--clues" sx={{flex: 1, display: 'flex'}}>
              {
                // Clues component
                ['across', 'down'].map((dir, i) => (
                  <Box key={i} className="editor--main--clues--list" sx={{display: 'flex'}}>
                    <Box className="editor--main--clues--list--title" sx={{display: 'flex'}}>
                      {dir.toUpperCase()}
                    </Box>
                    <Stack direction="column" sx={{flex: 1, display: 'flex'}}>
                      <Stack
                        direction="column"
                        sx={{
                          flex: 1,
                          flexBasis: 1,
                          display: 'flex',
                        }}
                        className={`editor--main--clues--list--scroll ${dir}`}
                      >
                        {renderClueList(dir as 'across' | 'down')}
                      </Stack>
                    </Stack>
                  </Box>
                ))
              }
            </Box>
            <Box className="editor--right--hints" sx={{display: 'flex'}}>
              <Hints grid={gridData} num={selectedClueNumber || 0} direction={direction} />
            </Box>
          </Stack>
        </Box>
      </GridControls>
    </Box>
  );
});

Editor.displayName = 'Editor';

export default Editor;
