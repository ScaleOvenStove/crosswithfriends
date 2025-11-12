/* eslint react/no-string-refs: "warn" */
import './css/index.css';

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {getTime} from '../../store/firebase';
import {lazy} from '@crosswithfriends/shared/lib/jsUtils';

import GridObject from '@crosswithfriends/shared/lib/wrappers/GridWrapper';

import Grid from '../Grid';
import ListView from '../ListView';
import Clues from './Clues';
import Clue from './ClueText';
import GridControls from './GridControls';
import MobileGridControls from './MobileGridControls';
import MobileListViewControls from './MobileListViewControls';
import ListViewControls from './ListViewControls';
import ConnectionStats from './ConnectionStats';

import {lightenHsl} from '@crosswithfriends/shared/lib/colors';
import * as gameUtils from '@crosswithfriends/shared/lib/gameUtils';
import {VimCommandBar} from './VimCommandBar';

const CURSOR_TIMEOUT = 60000;
const PING_TIMEOUT = 10000;

interface PlayerProps {
  currentCursor?: {r: number; c: number};
  size?: number;
  grid: any[][];
  clues: {across: string[]; down: string[]};
  updateGrid: (r: number, c: number, value: string) => void;
  updateCursor?: (selected: {r: number; c: number}) => void;
  addPing?: (ping: {r: number; c: number}) => void;
  onPressEnter?: () => void;
  onPressPeriod?: () => void;
  mobile?: boolean;
  listMode?: boolean;
  vimMode?: boolean;
  vimInsert?: boolean;
  vimCommand?: boolean;
  onVimNormal?: () => void;
  onVimInsert?: () => void;
  onVimCommand?: () => void;
  onVimCommandPressEnter?: (command: string) => void;
  onVimCommandPressEscape?: () => void;
  circles?: any[];
  shades?: any[];
  cursors?: any[];
  pings?: any[];
  frozen?: boolean;
  myColor?: string;
  users?: Record<string, {color?: string; displayName?: string}>;
  id?: string;
  pickups?: any[];
  clueBarStyle?: React.CSSProperties;
  gridStyle?: {cellStyle?: any};
  colorAttributionMode?: boolean;
  beta?: boolean;
  solution?: string[][];
  opponentGrid?: any[][];
  onCheck?: (scope: string) => void;
  onReveal?: (scope: string) => void;
  optimisticCounter?: number;
}

export type PlayerRef = {
  focus: () => void;
  selectClue: (direction: string, number: number) => void;
  getSelectedSquares: () => Array<{r: number; c: number}>;
  getSelectedAndHighlightedSquares: () => Array<{r: number; c: number}>;
  getAllSquares: () => Array<{r: number; c: number}>;
  setSelected: (selected: {r: number; c: number}) => void;
};

const Player = forwardRef<PlayerRef, PlayerProps>((props, ref) => {
  const getInitialSelected = useCallback(() => {
    const gridObj = new GridObject(props.grid);
    let r = 0;
    let c = 0;
    const direction = props.clues.across.length ? 'across' : 'down';
    while (!gridObj.isWhite(r, c) || !props.clues[direction][gridObj.getParent(r, c, direction)]) {
      if (c + 1 < props.grid[0].length) {
        c += 1;
      } else if (r + 1 < props.grid.length) {
        r += 1;
        c = 0;
      } else {
        return {r: 0, c: 0};
      }
    }
    return {r, c};
  }, [props.grid, props.clues]);

  const initialSelected = useMemo(() => {
    if (props.currentCursor?.r && props.currentCursor?.c) {
      return props.currentCursor;
    }
    return getInitialSelected();
  }, [props.currentCursor, getInitialSelected]);

  const [selected, setSelectedState] = useState<{r: number; c: number}>(initialSelected);
  const [direction, setDirection] = useState<'across' | 'down'>(
    props.clues.across.length ? 'across' : 'down'
  );
  const [size, setSize] = useState<number | undefined>(props.size);

  const gridControlsRef = useRef<any>(null);
  const gridRef = useRef<any>(null);
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);
  const gridObjRef = useRef<GridObject | null>(null);
  const prvNumRef = useRef<Record<string, number>>({});
  const cursorLockedRef = useRef<boolean>(false);
  const previousSizeRef = useRef<number | undefined>(undefined);

  const gridObj = useMemo(() => {
    if (!gridObjRef.current || gridObjRef.current.grid !== props.grid) {
      gridObjRef.current = new GridObject(props.grid);
    }
    return gridObjRef.current;
  }, [props.grid]);

  const selectedAdjusted = useMemo(() => {
    let {r, c} = selected;
    while (!gridObj.isWhite(r, c)) {
      if (c + 1 < props.grid[0].length) {
        c += 1;
      } else if (r + 1 < props.grid.length) {
        r += 1;
        c = 0;
      } else {
        return {r: 0, c: 0};
      }
    }
    return {r, c};
  }, [selected, gridObj, props.grid]);

  const actualSize = useMemo(() => {
    return size || props.size || 20;
  }, [size, props.size]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (gridControlsRef.current) {
          gridControlsRef.current.focus();
        }
      },
      selectClue: (dir: string, num: number) => {
        if (gridControlsRef.current) {
          gridControlsRef.current.selectClue(dir, num);
        }
      },
      getSelectedSquares: () => {
        return gridObj
          .keys()
          .map(([r, c]) => ({r, c}))
          .filter(({r, c}) => {
            if (gridRef.current) {
              return gridRef.current.isSelected(r, c);
            }
            return false;
          });
      },
      getSelectedAndHighlightedSquares: () => {
        return gridObj
          .keys()
          .map(([r, c]) => ({r, c}))
          .filter(({r, c}) => {
            if (gridRef.current) {
              return gridRef.current.isSelected(r, c) || gridRef.current.isHighlighted(r, c);
            }
            return false;
          });
      },
      getAllSquares: () => {
        return gridObj.keys().map(([r, c]) => ({r, c}));
      },
      setSelected: (sel: {r: number; c: number}) => {
        setSelected(sel);
      },
    }),
    [gridObj]
  );

  const updateSize = useCallback(() => {
    const el = mobileContainerRef.current;
    if (!el) return;
    const {width, height} = el.getBoundingClientRect();
    const rows = props.grid.length;
    const cols = props.grid[0].length;
    const newSize = Math.floor(Math.min(width / cols, height / rows));
    setSize(newSize);
  }, [props.grid]);

  useEffect(() => {
    const el = mobileContainerRef.current;
    if (!el) return;

    // Use ResizeObserver to watch the container element for size changes
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(el);

    // Also listen to window resize as a fallback
    window.addEventListener('resize', updateSize);

    // Initial size calculation
    updateSize();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [updateSize]);

  useEffect(() => {
    if (
      props.currentCursor &&
      (props.currentCursor.r !== selected.r || props.currentCursor.c !== selected.c)
    ) {
      setSelectedState({
        r: props.currentCursor.r,
        c: props.currentCursor.c,
      });
    }
  }, [props.currentCursor]);

  useEffect(() => {
    const wrapper = document.querySelector('.player--main--wrapper');
    if (wrapper) {
      previousSizeRef.current = wrapper.getBoundingClientRect().width;
    }
  });

  const isValidDirection = useCallback(
    (dir: 'across' | 'down', sel: {r: number; c: number}) => {
      return gridObj.getParent(sel.r, sel.c, dir) !== 0;
    },
    [gridObj]
  );

  const canSetDirection = useCallback(
    (dir: 'across' | 'down') => {
      return isValidDirection(dir, selectedAdjusted);
    },
    [isValidDirection, selectedAdjusted]
  );

  const setDirectionHandler = useCallback(
    (dir: 'across' | 'down') => {
      if (isValidDirection(dir, selectedAdjusted)) {
        setDirection(dir);
      }
    },
    [isValidDirection, selectedAdjusted]
  );

  const setSelected = useCallback(
    (sel: {r: number; c: number}) => {
      if (cursorLockedRef.current) return;
      if (!gridObj.isWhite(sel.r, sel.c)) {
        return;
      }
      if (gridObj.isHidden(sel.r, sel.c)) {
        return;
      }
      if (isValidDirection(direction, sel)) {
        if (sel.r !== selectedAdjusted.r || sel.c !== selectedAdjusted.c) {
          setSelectedState(sel);
          if (props.updateCursor) {
            props.updateCursor({
              r: sel.r,
              c: sel.c,
            });
          }
        }
      } else if (isValidDirection(gameUtils.getOppositeDirection(direction), sel)) {
        setSelectedState(sel);
        setDirection(gameUtils.getOppositeDirection(direction));
        if (props.updateCursor) {
          props.updateCursor({
            r: sel.r,
            c: sel.c,
          });
        }
      }
    },
    [gridObj, isValidDirection, direction, selectedAdjusted, props.updateCursor]
  );

  const handlePing = useCallback(
    (r: number, c: number) => {
      if (props.addPing) {
        props.addPing({r, c});
      }
    },
    [props.addPing]
  );

  const changeDirection = useCallback(() => {
    if (cursorLockedRef.current) return;
    setDirection(gameUtils.getOppositeDirection(direction));
  }, [direction]);

  const selectClue = useCallback((dir: string, number: number) => {
    if (gridControlsRef.current) {
      gridControlsRef.current.selectClue(dir, number);
    }
  }, []);

  const getSelectedClueNumber = useCallback(() => {
    return gridObj.getParent(selectedAdjusted.r, selectedAdjusted.c, direction);
  }, [gridObj, selectedAdjusted, direction]);

  const getHalfSelectedClueNumber = useCallback(() => {
    return gridObj.getParent(
      selectedAdjusted.r,
      selectedAdjusted.c,
      gameUtils.getOppositeDirection(direction)
    );
  }, [gridObj, selectedAdjusted, direction]);

  const getClueBarAbbreviation = useCallback(() => {
    return getSelectedClueNumber() + direction.substr(0, 1).toUpperCase();
  }, [getSelectedClueNumber, direction]);

  const getClueBarText = useCallback(() => {
    return props.clues[direction][getSelectedClueNumber()];
  }, [props.clues, direction, getSelectedClueNumber]);

  const isClueFilled = useCallback(
    (dir: 'across' | 'down', number: number) => {
      const clueRoot = gridObj.getCellByNumber(number);
      if (!clueRoot) return false;
      return !gridObj.hasEmptyCells(clueRoot.r, clueRoot.c, dir);
    },
    [gridObj]
  );

  const isClueSelected = useCallback(
    (dir: 'across' | 'down', number: number) => {
      return dir === direction && number === getSelectedClueNumber();
    },
    [direction, getSelectedClueNumber]
  );

  const isClueHalfSelected = useCallback(
    (dir: 'across' | 'down', number: number) => {
      return dir !== direction && number === getHalfSelectedClueNumber();
    },
    [direction, getHalfSelectedClueNumber]
  );

  const getReferences = useCallback(() => {
    const clueText = getClueBarText();
    return gameUtils.getReferencedClues(clueText, props.clues);
  }, [getClueBarText, props.clues]);

  // Memoize the result of getReferences() to prevent creating new arrays on every render
  const references = useMemo(() => getReferences(), [getReferences]);

  const scrollToClue = useCallback((dir: string, num: number, el: HTMLElement | null) => {
    if (el && prvNumRef.current[dir] !== num) {
      prvNumRef.current[dir] = num;
      lazy(`scrollToClue${dir}`, () => {
        const parent = el.offsetParent;
        if (parent) {
          parent.scrollTop = el.offsetTop - parent.offsetHeight * 0.4;
        }
      });
    }
  }, []);

  const handleSetCursorLock = useCallback((val: boolean) => {
    setTimeout(
      () => {
        cursorLockedRef.current = val;
      },
      val ? 0 : 150
    );
  }, []);

  const renderColorAttributionCounts = useCallback(() => {
    if (!props.colorAttributionMode) {
      return null;
    }

    // map from user_id to number of squares solved by that user
    const counts: Record<string, number> = {};
    props.grid.forEach((row) => {
      row.forEach((cell: any) => {
        if (cell.user_id) {
          counts[cell.user_id] = (counts[cell.user_id] || 0) + 1;
        }
      });
    });

    if (Object.keys(counts).length === 0) {
      return null;
    }

    return (
      <div style={{marginTop: 24}}>
        <strong>Squares filled by user</strong>
        {Object.entries(counts)
          .sort(([, countA], [, countB]) => countB - countA) // descending
          .map(([userId, count]) => (
            <div key={userId} style={{color: props.users?.[userId]?.color}}>
              {props.users?.[userId]?.displayName} - {count}
            </div>
          ))}
      </div>
    );
  }, [props.colorAttributionMode, props.grid, props.users]);

  const {
    mobile,
    onPressEnter,
    onPressPeriod,
    listMode,
    vimMode,
    vimInsert,
    vimCommand,
    onVimNormal,
    onVimInsert,
    onVimCommand,
    grid,
    clues,
    circles,
    beta,
    cursors: allCursors = [],
    pings: allPings = [],
    updateGrid,
    frozen,
    myColor,
    users = {},
    id,
    pickups,
    clueBarStyle = {},
    gridStyle = {},
    colorAttributionMode,
  } = props;
  const {cellStyle = {}} = gridStyle;

  const currentTime = getTime();
  const cursors = useMemo(
    () =>
      allCursors
        .filter((cursor) => cursor.id !== id)
        .map((cursor) => ({
          ...cursor,
          active: cursor.timestamp > currentTime - CURSOR_TIMEOUT,
          color: users[cursor.id]?.color || 'blue',
          displayName: users[cursor.id]?.displayName || '',
        })),
    [allCursors, id, currentTime, users]
  );

  const pings = useMemo(
    () =>
      allPings
        .map((ping) => ({
          ...ping,
          active: ping.timestamp > currentTime - PING_TIMEOUT,
          age: (currentTime - ping.timestamp) / PING_TIMEOUT,
          color: users[ping.id]?.color || 'blue',
        }))
        .filter(({active}) => active),
    [allPings, currentTime, users]
  );

  const gridWithColors = useMemo(
    () =>
      grid.map((row) =>
        row.map((cell) => ({
          ...cell,
          attributionColor: cell.value && colorAttributionMode ? lightenHsl(users[cell.user_id]?.color) : '',
        }))
      ),
    [grid, colorAttributionMode, users]
  );

  const gridProps = useMemo(
    () => ({
      size: actualSize,
      grid: gridWithColors,
      circles,
      selected: selectedAdjusted,
      references, // Use memoized references instead of calling getReferences()
      direction,
      cursors,
      pings,
      onSetSelected: setSelected,
      onPing: handlePing,
      cellStyle,
      myColor,
      onChangeDirection: changeDirection,
      pickups,
      frozen,
    }),
    [
      actualSize,
      gridWithColors,
      circles,
      selectedAdjusted,
      references, // Use memoized references
      direction,
      cursors,
      pings,
      setSelected,
      handlePing,
      cellStyle,
      myColor,
      changeDirection,
      pickups,
      frozen,
    ]
  );

  const clueProps = useMemo(
    () => ({
      clues: props.clues,
      clueLengths: gridObj.clueLengths,
      isClueSelected,
      isClueHalfSelected,
      isClueFilled,
      scrollToClue,
      selectClue,
    }),
    [
      props.clues,
      gridObj.clueLengths,
      isClueSelected,
      isClueHalfSelected,
      isClueFilled,
      scrollToClue,
      selectClue,
    ]
  );

  const listViewProps = useMemo(
    () => ({
      ...gridProps,
      ...clueProps,
      size: Math.min(20, actualSize),
    }),
    [gridProps, clueProps, actualSize]
  );

  if (mobile) {
    if (listMode) {
      return (
        <div className="player--mobile--wrapper mobile">
          <MobileListViewControls
            ref={gridControlsRef}
            onPressEnter={onPressEnter}
            onPressPeriod={onPressPeriod}
            selected={selectedAdjusted}
            direction={direction}
            onSetDirection={setDirectionHandler}
            onChangeDirection={changeDirection}
            canSetDirection={canSetDirection}
            onSetSelected={setSelected}
            updateGrid={updateGrid}
            size={actualSize}
            grid={grid}
            clues={clues}
            onSetCursorLock={handleSetCursorLock}
            enableDebug={window.location.search.indexOf('debug') !== -1}
          >
            <div className="player--mobile" ref={mobileContainerRef}>
              <div className={`player--mobile--list-view`}>
                <ListView ref={gridRef} {...listViewProps} />
              </div>
            </div>
          </MobileListViewControls>
          {renderColorAttributionCounts()}
        </div>
      );
    }
    return (
      <div className="player--mobile--wrapper mobile">
        <MobileGridControls
          enablePan
          ref={gridControlsRef}
          onPressEnter={onPressEnter}
          onPressPeriod={onPressPeriod}
          selected={selectedAdjusted}
          direction={direction}
          onSetDirection={setDirection}
          onChangeDirection={changeDirection}
          canSetDirection={canSetDirection}
          onSetSelected={setSelected}
          updateGrid={updateGrid}
          size={actualSize}
          grid={grid}
          clues={clues}
          onSetCursorLock={handleSetCursorLock}
          enableDebug={window.location.search.indexOf('debug') !== -1}
        >
          <div className="player--mobile" ref={mobileContainerRef}>
            <div className={`player--mobile--grid${frozen ? ' frozen' : ''}`}>
              <Grid ref={gridRef} {...gridProps} />
            </div>
          </div>
        </MobileGridControls>
        {renderColorAttributionCounts()}
      </div>
    );
  }

  if (listMode) {
    return (
      <div
        className="player--main--wrapper"
        style={{
          minWidth: previousSizeRef.current,
        }}
      >
        <ListViewControls
          ref={gridControlsRef}
          onPressEnter={onPressEnter}
          onPressPeriod={onPressPeriod}
          vimMode={vimMode}
          vimInsert={vimInsert}
          vimCommand={vimCommand}
          onVimInsert={onVimInsert}
          onVimNormal={onVimNormal}
          onVimCommand={onVimCommand}
          selected={selectedAdjusted}
          direction={direction}
          onSetDirection={setDirection}
          canSetDirection={canSetDirection}
          onSetSelected={setSelected}
          updateGrid={updateGrid}
          grid={grid}
          clues={clues}
          beta={beta}
          onCheck={props.onCheck}
          onReveal={props.onReveal}
        >
          <div className="player--main">
            <div className="player--main--list-view">
              <ListView ref={gridRef} {...listViewProps} />
            </div>
          </div>
        </ListViewControls>
        {renderColorAttributionCounts()}
      </div>
    );
  }

  return (
    <div className="player--main--wrapper">
      <GridControls
        ref={gridControlsRef}
        onPressEnter={onPressEnter}
        onPressPeriod={onPressPeriod}
        vimMode={vimMode}
        vimInsert={vimInsert}
        vimCommand={vimCommand}
        onVimInsert={onVimInsert}
        onVimNormal={onVimNormal}
        onVimCommand={onVimCommand}
        selected={selectedAdjusted}
        direction={direction}
        onSetDirection={setDirection}
        canSetDirection={canSetDirection}
        onSetSelected={setSelected}
        updateGrid={updateGrid}
        grid={grid}
        clues={clues}
        beta={beta}
        onCheck={props.onCheck}
        onReveal={props.onReveal}
      >
        <div className="player--main">
          <div className="player--main--left">
            <div className="player--main--clue-bar" style={clueBarStyle}>
              <div className="player--main--clue-bar--number">{getClueBarAbbreviation()}</div>
              <div className="player--main--clue-bar--text--wrapper">
                <div className="player--main--clue-bar--text">
                  <Clue text={getClueBarText()} />
                </div>
              </div>
            </div>

            <div className={`player--main--left--grid${frozen ? ' frozen' : ''} blurable`}>
              <Grid ref={gridRef} {...gridProps} />
            </div>
            {vimMode && (
              <VimCommandBar
                isVimCommandMode={props.vimCommand}
                isVimInsertMode={props.vimInsert}
                onVimCommand={props.onVimCommand}
                onEnter={props.onVimCommandPressEnter}
                onEscape={props.onVimCommandPressEscape}
              />
            )}
          </div>

          <div className="player--main--clues">
            <Clues {...clueProps} />
          </div>
        </div>
      </GridControls>
      {props.beta && (
        <div
          style={{
            color: 'gray',
            margin: '0 auto',
          }}
        >
          <div>{props.optimisticCounter ? <>{props.optimisticCounter} ahead</> : <>Synced</>}</div>
          <div>
            <ConnectionStats />
          </div>
        </div>
      )}
      {renderColorAttributionCounts()}
    </div>
  );
});

Player.displayName = 'Player';

// Memoize Player component to prevent unnecessary re-renders
// Note: This is a complex component with many props, so we rely on parent components
// to properly memoize callbacks and data to avoid re-renders
export default React.memo(Player);
