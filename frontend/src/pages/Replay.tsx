import './css/replay.css';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Box, Stack} from '@mui/material';
import {Helmet} from 'react-helmet';
import {MdPlayArrow, MdPause, MdChevronLeft, MdChevronRight} from 'react-icons/md';
import _ from 'lodash';
import {useParams} from 'react-router-dom';

import {useGameStore} from '../store';

import HistoryWrapper from '@crosswithfriends/shared/lib/wrappers/HistoryWrapper';
import Player from '../components/Player';
import Chat from '../components/Chat';
import Nav from '../components/common/Nav';
import {Timeline} from '../components/Timeline/Timeline';
import {isMobile, toArr} from '@crosswithfriends/shared/lib/jsUtils';
import Toolbar from '../components/Toolbar';
import {Tooltip} from '@mui/material';

const SCRUB_SPEED = 50; // 30 actions per second
const AUTOPLAY_SPEEDS = (localStorage as any).premium ? [1, 10, 100, 1000] : [1, 10, 100];

const formatTime = (seconds: number): string => {
  const hr = Math.floor(seconds / 3600);
  const min = Math.floor((seconds - hr * 3600) / 60);
  const sec = Math.floor(seconds - hr * 3600 - min * 60);
  if (hr) {
    return `${hr}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

interface GameEvent {
  gameTimestamp: number;
  type: string;
}

const Replay: React.FC = () => {
  const params = useParams<{gid: string}>();
  const [history, setHistory] = useState<GameEvent[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<GameEvent[]>([]);
  const [position, setPosition] = useState<number>(0);
  const [positionToRender, setPositionToRender] = useState<number>(0);
  const [autoplayEnabled, setAutoplayEnabled] = useState<boolean>(false);
  const [autoplaySpeed, setAutoplaySpeed] = useState<number>(10);
  const [colorAttributionMode, setColorAttributionMode] = useState<boolean>(false);
  const [listMode, setListMode] = useState<boolean>(false);
  const [left, setLeft] = useState<boolean>(false);
  const [right, setRight] = useState<boolean>(false);
  const [error, setError] = useState<any>(undefined);

  const gameStore = useGameStore();
  const historyWrapperRef = useRef<HistoryWrapper | null>(null);
  const followCursorRef = useRef<number | undefined>(-1);
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const screenWidthRef = useRef<number>(0);
  const colorRef = useRef<string>('#000000');
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<any>(null);
  const chatRef = useRef<any>(null);
  const scrubLeftRef = useRef<any>(null);
  const scrubRightRef = useRef<any>(null);

  const gid = useMemo(() => {
    return params.gid || '';
  }, [params.gid]);

  const game = useMemo(() => {
    // compute the game state corresponding to current playback time
    if (!historyWrapperRef.current || !historyWrapperRef.current.ready) return null;
    return historyWrapperRef.current.getSnapshotAt(positionToRender);
  }, [positionToRender]);

  const recomputeHistory = useCallback((): void => {
    if (!historyWrapperRef.current) return;
    const newHistory = [
      historyWrapperRef.current.createEvent,
      ...historyWrapperRef.current.history,
    ] as GameEvent[];
    const newFilteredHistory = newHistory.filter(
      (event) => event.type !== 'updateCursor' && event.type !== 'chat'
    );
    const newPosition = position || newHistory[0].gameTimestamp;
    setHistory(newHistory);
    setFilteredHistory(newFilteredHistory);
    setPosition(newPosition);
  }, [position]);

  const debouncedRecomputeHistoryRef = useRef<_.DebouncedFunc<() => void>>();
  if (!debouncedRecomputeHistoryRef.current) {
    debouncedRecomputeHistoryRef.current = _.debounce(recomputeHistory);
  }

  const setPositionToRenderThrottledRef = useRef<_.DebouncedFunc<(positionToRender: number) => void>>();
  if (!setPositionToRenderThrottledRef.current) {
    setPositionToRenderThrottledRef.current = _.throttle((positionToRender: number) => {
      setPositionToRender(positionToRender);
      if (controlsRef.current) {
        controlsRef.current.focus();
      }
    }, 200);
  }

  const handleSetPosition = useCallback(
    (newPosition: number, isAutoplay: boolean = false): void => {
      if (history.length === 0) return;
      const clampedPosition = Math.min(newPosition, history[history.length - 1].gameTimestamp);
      setPosition(clampedPosition);
      setPositionToRenderThrottledRef.current?.(clampedPosition);
      if (!isAutoplay && autoplayEnabled) {
        setAutoplayEnabled(false);
      }
    },
    [history, autoplayEnabled]
  );

  useEffect(() => {
    const path = `/game/${gid}`;
    const historyWrapper = new HistoryWrapper();
    historyWrapperRef.current = historyWrapper;

    const unsubscribeWsEvent = gameStore.subscribe(path, 'wsEvent', (event: any) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.addEvent(event);
        debouncedRecomputeHistoryRef.current?.();
      }
    });
    const unsubscribeWsCreateEvent = gameStore.subscribe(path, 'wsCreateEvent', (event: any) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.setCreateEvent(event);
        debouncedRecomputeHistoryRef.current?.();
      }
    });
    gameStore.attach(path);

    // compute it here so the grid doesn't go crazy
    screenWidthRef.current = window.innerWidth - 1;
    if (controlsRef.current) {
      setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.focus();
        }
      }, 100);
    }

    autoplayIntervalRef.current = setInterval(() => {
      if (autoplayEnabled && history.length > 0) {
        if (position < history[history.length - 1].gameTimestamp) {
          handleSetPosition(position + 100 * autoplaySpeed, true);
        } else {
          setAutoplayEnabled(false);
        }
      }
    }, 100);

    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      unsubscribeWsEvent();
      unsubscribeWsCreateEvent();
      gameStore.detach(path);
    };
  }, [gid, autoplayEnabled, history, position, autoplaySpeed, handleSetPosition, gameStore]);

  useEffect(() => {
    if (!gameRef.current) return;
    if (!game || !game.cursors) return;
    const gameCursors = game.cursors;
    if (followCursorRef.current === -1) {
      // follow a random cursor in the beginning
      if (gameCursors.length > 0) {
        followCursorRef.current = gameCursors[0].id;
      }
    }

    if (followCursorRef.current !== undefined) {
      const cursor = _.find(gameCursors, (cursor: any) => cursor.id === followCursorRef.current);
      if (cursor && gameRef.current) {
        gameRef.current.setSelected({
          r: cursor.r,
          c: cursor.c,
        });
      }
    }
  }, [position, game]);

  const focus = useCallback((): void => {
    if (controlsRef.current) {
      controlsRef.current.focus();
    }
  }, []);

  const handleUpdateCursor = useCallback(
    ({r, c}: {r: number; c: number}): void => {
      if (!game || !game.cursors) return;
      const gameCursors = game.cursors;
      const cursor = _.find(gameCursors, (cursor: any) => cursor.r === r && cursor.c === c);
      if (cursor !== undefined) {
        followCursorRef.current = cursor.id;
      } else {
        followCursorRef.current = undefined;
      }
    },
    [game]
  );

  const scrubLeft = useCallback(
    ({shift = false}: {shift?: boolean} = {}): void => {
      const events = shift ? filteredHistory : history;
      const index = _.findLastIndex(events, (event) => event.gameTimestamp < position);
      if (!left) {
        setLeft(true);
      }
      if (index === -1) return;
      handleSetPosition(events[index].gameTimestamp);
    },
    [position, history, filteredHistory, left, handleSetPosition]
  );

  const scrubRight = useCallback(
    ({shift = false}: {shift?: boolean} = {}): void => {
      const events = shift ? filteredHistory : history;
      const index = _.findIndex(events, (event) => event.gameTimestamp > position);
      if (!right) {
        setRight(true);
      }
      if (index === -1) return;
      handleSetPosition(events[index].gameTimestamp);
    },
    [position, history, filteredHistory, right, handleSetPosition]
  );

  const handleMouseDownLeft = useCallback(
    (e: React.MouseEvent | React.TouchEvent): void => {
      e.preventDefault();
      focus();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(scrubLeft, 1000 / SCRUB_SPEED);
    },
    [focus, scrubLeft]
  );

  const handleMouseDownRight = useCallback(
    (e: React.MouseEvent | React.TouchEvent): void => {
      e.preventDefault();
      focus();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(scrubRight, 1000 / SCRUB_SPEED);
    },
    [focus, scrubRight]
  );

  const handleMouseUpLeft = useCallback((): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setLeft(false);
  }, []);

  const handleMouseUpRight = useCallback((): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRight(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      e.preventDefault();
      const shift = e.shiftKey;
      if (e.key === 'ArrowLeft') {
        scrubLeft({shift});
      } else if (e.key === 'ArrowRight') {
        scrubRight({shift});
      } else if (e.key === ' ') {
        handleToggleAutoplay();
      }
    },
    [scrubLeft, scrubRight]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent): void => {
    e.preventDefault();
    if (e.key === 'ArrowLeft') {
      setLeft(false);
    } else if (e.key === 'ArrowRight') {
      setRight(false);
    }
  }, []);

  const handleToggleAutoplay = useCallback((): void => {
    const index = _.findIndex(history, (event) => event.gameTimestamp > position);
    if (index === -1) {
      // restart
      handleSetPosition(0);
    }
    setAutoplayEnabled((prev) => !prev);
  }, [history, position, handleSetPosition]);

  const renderHeader = useCallback((): JSX.Element | null => {
    if (!game || error) {
      return null;
    }
    const {title, author, type} = game.info;
    return (
      <div>
        <div className="header--title">{title}</div>

        <div className="header--subtitle">{type && `${type} | By ${author}`}</div>
      </div>
    );
  }, [game, error]);

  const renderToolbar = useCallback((): JSX.Element | undefined => {
    if (!game) return undefined;
    const {clock, solved} = game;
    const {totalTime} = clock;
    return (
      <Toolbar
        v2
        replayMode
        gid={gid}
        mobile={isMobile()}
        pausedTime={totalTime}
        colorAttributionMode={colorAttributionMode}
        listMode={listMode}
        onToggleColorAttributionMode={() => {
          setColorAttributionMode((prev) => !prev);
        }}
        onToggleListView={() => {
          setListMode((prev) => !prev);
        }}
      />
    );
  }, [game, gid, colorAttributionMode, listMode]);

  const renderPlayer = useCallback((): JSX.Element => {
    if (error) {
      return <div>Error loading replay</div>;
    }
    if (!game) {
      return <div>Loading...</div>;
    }

    const {grid, circles, shades, cursors, clues, solved, users} = game;
    const screenWidth = screenWidthRef.current;
    const cols = grid[0].length;
    const rows = grid.length;
    const width = Math.min((35 * 15 * cols) / rows, screenWidth - 20);
    const size = width / cols;
    return (
      <Player
        ref={gameRef}
        size={size}
        grid={grid}
        circles={circles}
        shades={shades}
        clues={{
          across: toArr(clues.across),
          down: toArr(clues.down),
        }}
        cursors={cursors}
        frozen={solved}
        myColor={colorRef.current}
        updateGrid={_.noop}
        updateCursor={handleUpdateCursor}
        onPressEnter={_.noop}
        mobile={isMobile()}
        users={users}
        colorAttributionMode={colorAttributionMode}
        listMode={listMode}
      />
    );
  }, [error, game, colorAttributionMode, listMode, handleUpdateCursor]);

  const renderChat = useCallback((): JSX.Element | null => {
    if (error || !game) {
      return null;
    }

    return (
      <div className="replay--chat">
        <Chat ref={chatRef} info={game.info} data={game.chat} colors={game.colors} hideChatBar />
      </div>
    );
  }, [error, game]);

  const renderControls = useCallback((): JSX.Element => {
    const width = isMobile() ? screenWidthRef.current - 20 : 1000;

    // renders the controls / state
    return (
      <div
        ref={controlsRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 10,
          outline: 'none',
          width,
        }}
        tabIndex={1}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        {history.length > 0 ? (
          <Timeline width={width} history={history} position={position} onSetPosition={handleSetPosition} />
        ) : null}
        <div className="replay--control-icons">
          <MdChevronLeft
            ref={scrubLeftRef}
            className={`scrub ${left ? 'active' : ''}`}
            onMouseDown={handleMouseDownLeft}
            onMouseUp={handleMouseUpLeft}
            onTouchStart={handleMouseDownLeft}
            onTouchEnd={handleMouseUpLeft}
            onMouseLeave={handleMouseUpLeft}
          />
          <div className="scrub--autoplay" onClick={handleToggleAutoplay}>
            {autoplayEnabled && <MdPause />}
            {!autoplayEnabled && <MdPlayArrow />}
          </div>
          <Tooltip title="Shortcut: Right Arrow">
            <MdChevronRight
              ref={scrubRightRef}
              className={`scrub ${right ? 'active' : ''}`}
              onMouseDown={handleMouseDownRight}
              onTouchStart={handleMouseDownRight}
              onTouchEnd={handleMouseUpRight}
              onMouseUp={handleMouseUpRight}
              onMouseLeave={handleMouseUpRight}
            />
          </Tooltip>
        </div>
        <div className="replay--time">
          {history.length > 0 && (
            <div>
              {formatTime(position / 1000)} / {formatTime(_.last(history)!.gameTimestamp / 1000)}
            </div>
          )}
        </div>
        <div className="scrub--speeds">
          {AUTOPLAY_SPEEDS.map((speed) => (
            <div
              className={`scrub--speed--option${speed === autoplaySpeed ? ' selected' : ''}`}
              onClick={() => {
                setAutoplaySpeed(speed);
              }}
              key={speed}
            >
              {speed}x
            </div>
          ))}
        </div>
      </div>
    );
  }, [
    history,
    position,
    left,
    right,
    autoplayEnabled,
    autoplaySpeed,
    handleKeyDown,
    handleKeyUp,
    handleSetPosition,
    handleMouseDownLeft,
    handleMouseUpLeft,
    handleMouseDownRight,
    handleMouseUpRight,
    handleToggleAutoplay,
  ]);

  const puzzleTitle = useMemo((): string => {
    if (!game || !game.info) return '';
    return game.info.title;
  }, [game]);

  return (
    <Stack direction="column" className="replay">
      {!isMobile() && <Nav v2 />}
      <Helmet>
        <title>{`Replay ${gid}: ${puzzleTitle}`}</title>
      </Helmet>
      {!isMobile() && (
        <div
          style={{
            paddingLeft: 30,
            paddingTop: 20,
            paddingBottom: 20,
          }}
        >
          {renderHeader()}
        </div>
      )}
      {renderToolbar()}
      <Stack
        direction="column"
        sx={{
          flex: 1,
          padding: isMobile() ? 0 : 1.25,
          border: '1px solid #E2E2E2',
        }}
      >
        <Box sx={{flex: 1, padding: isMobile() ? 0 : 2.5}}>{renderPlayer()}</Box>
        <div
          style={{
            zIndex: 1,
            // flex: 1,
          }}
        >
          {renderControls()}
        </div>
      </Stack>
      {/* Controls:
      Playback scrubber
      Playback speed toggle
      Skip inactivity checkbox */}
    </Stack>
  );
};

export default Replay;
