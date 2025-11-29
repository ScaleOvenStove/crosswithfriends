import './css/replay.css';
import {isMobile, toArr} from '@crosswithfriends/shared/lib/jsUtils';
import HistoryWrapper from '@crosswithfriends/shared/lib/wrappers/HistoryWrapper';
import {Box, Stack, Tooltip} from '@mui/material';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {MdPlayArrow, MdPause, MdChevronLeft, MdChevronRight} from 'react-icons/md';
import {useParams} from 'react-router-dom';

type DebouncedFunc<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
};

const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number = 0): DebouncedFunc<T> => {
  let timeout: NodeJS.Timeout;
  let pendingArgs: Parameters<T> | null = null;
  const debounced = (...args: Parameters<T>) => {
    pendingArgs = args;
    clearTimeout(timeout);
    if (delay === 0) {
      // For 0 delay, use queueMicrotask to ensure it executes even with rapid calls
      timeout = setTimeout(() => {
        if (pendingArgs) {
          fn(...pendingArgs);
          pendingArgs = null;
        }
      }, 0);
    } else {
      timeout = setTimeout(() => {
        if (pendingArgs) {
          fn(...pendingArgs);
          pendingArgs = null;
        }
      }, delay);
    }
  };
  debounced.cancel = () => {
    clearTimeout(timeout);
    pendingArgs = null;
  };
  debounced.flush = () => {
    clearTimeout(timeout);
    if (pendingArgs) {
      fn(...pendingArgs);
      pendingArgs = null;
    }
  };
  return debounced;
};

const throttle = <T extends (...args: any[]) => any>(fn: T, limit: number): DebouncedFunc<T> => {
  let inThrottle: boolean;
  let pendingArgs: Parameters<T> | null = null;
  let timeout: NodeJS.Timeout | null = null;
  const throttled = (...args: Parameters<T>) => {
    pendingArgs = args;
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      timeout = setTimeout(() => {
        inThrottle = false;
        timeout = null;
      }, limit);
    }
  };
  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    pendingArgs = null;
  };
  throttled.flush = () => {
    if (pendingArgs && !inThrottle) {
      fn(...pendingArgs);
      pendingArgs = null;
    }
  };
  return throttled;
};

const findLastIndex = <T,>(arr: T[], fn: (item: T) => boolean): number => {
  for (let i = arr.length - 1; i >= 0; i--) {
    const item = arr[i];
    if (item !== undefined && fn(item)) {
      return i;
    }
  }
  return -1;
};

import Nav from '../components/common/Nav';
import Player from '../components/Player';
import type {PlayerRef} from '../components/Player/Player';
import {Timeline} from '../components/Timeline/Timeline';
import Toolbar from '../components/Toolbar';
import {useGameStore} from '../store';

const SCRUB_SPEED = 50; // 30 actions per second
const AUTOPLAY_SPEEDS = (localStorage as {premium?: boolean}).premium ? [1, 10, 100, 1000] : [1, 10, 100];

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
  const [error, setError] = useState<Error | undefined>(undefined);

  const gameStore = useGameStore();
  const historyWrapperRef = useRef<HistoryWrapper | null>(null);
  const followCursorRef = useRef<number | undefined>(-1);
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [screenWidth, setScreenWidth] = useState<number>(0);
  const [myColor, _setMyColor] = useState<string>('#000000');
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<PlayerRef | null>(null);

  const gid = useMemo(() => {
    return params.gid || '';
  }, [params.gid]);

  const [gameState, setGameState] = useState<ReturnType<HistoryWrapper['getSnapshotAt']> | null>(null);

  useEffect(() => {
    // compute the game state corresponding to current playback time
    try {
      if (!historyWrapperRef.current || !historyWrapperRef.current.ready) {
        // Use setTimeout to avoid calling setState synchronously in effect
        setTimeout(() => {
          setGameState(null);
        }, 0);
        return;
      }
      const snapshot = historyWrapperRef.current.getSnapshotAt(positionToRender);
      setGameState(snapshot);
    } catch (err) {
      setError(err as Error);
      setTimeout(() => {
        setGameState(null);
      }, 0);
    }
  }, [positionToRender]);

  const game = gameState;

  const recomputeHistory = useCallback((): void => {
    if (!historyWrapperRef.current) return;
    const newHistory = [
      historyWrapperRef.current.createEvent,
      ...historyWrapperRef.current.history,
    ] as GameEvent[];
    const newFilteredHistory = newHistory.filter(
      (event) => event.type !== 'updateCursor' && event.type !== 'chat'
    );
    const newPosition = position || (newHistory[0]?.gameTimestamp ?? 0);
    setHistory(newHistory);
    setFilteredHistory(newFilteredHistory);
    setPosition(newPosition);
  }, [position]);

  const debouncedRecomputeHistoryRef = useRef<DebouncedFunc<() => void> | undefined>(undefined);
  useEffect(() => {
    // Flush any pending execution from the old debounced function before creating a new one
    debouncedRecomputeHistoryRef.current?.flush();
    debouncedRecomputeHistoryRef.current = debounce(recomputeHistory, 0);
    return () => {
      // Flush before cancelling to ensure any pending execution completes
      debouncedRecomputeHistoryRef.current?.flush();
      debouncedRecomputeHistoryRef.current?.cancel();
    };
  }, [recomputeHistory]);

  const setPositionToRenderThrottledRef = useRef<
    DebouncedFunc<(positionToRender: number) => void> | undefined
  >(undefined);
  useEffect(() => {
    setPositionToRenderThrottledRef.current = throttle((newPositionToRender: number) => {
      setPositionToRender(newPositionToRender);
      if (controlsRef.current) {
        controlsRef.current.focus();
      }
    }, 200);
    return () => {
      setPositionToRenderThrottledRef.current?.cancel();
    };
  }, [setPositionToRender]);

  const handleSetPosition = useCallback(
    (newPosition: number, isAutoplay: boolean = false): void => {
      if (history.length === 0) return;
      const lastEvent = history[history.length - 1];
      if (!lastEvent) return;
      const clampedPosition = Math.min(newPosition, lastEvent.gameTimestamp);
      setPosition(clampedPosition);
      setPositionToRenderThrottledRef.current?.(clampedPosition);
      if (!isAutoplay && autoplayEnabled) {
        setAutoplayEnabled(false);
      }
    },
    [history, autoplayEnabled]
  );

  // Store latest values in refs to avoid dependency issues
  const autoplayEnabledRef = useRef(autoplayEnabled);
  const historyRef = useRef(history);
  const positionRef = useRef(position);
  const autoplaySpeedRef = useRef(autoplaySpeed);
  const handleSetPositionRef = useRef(handleSetPosition);

  useEffect(() => {
    autoplayEnabledRef.current = autoplayEnabled;
    historyRef.current = history;
    positionRef.current = position;
    autoplaySpeedRef.current = autoplaySpeed;
    handleSetPositionRef.current = handleSetPosition;
  }, [autoplayEnabled, history, position, autoplaySpeed, handleSetPosition]);

  // Setup/teardown effect - only depends on gid
  useEffect(() => {
    const path = `/game/${gid}`;
    const historyWrapper = new HistoryWrapper();
    historyWrapperRef.current = historyWrapper;

    const unsubscribeWsEvent = gameStore.subscribe(path, 'wsEvent', (data: unknown) => {
      try {
        const event = data as GameEvent;
        if (historyWrapperRef.current) {
          historyWrapperRef.current.addEvent(event);
          debouncedRecomputeHistoryRef.current?.();
        }
      } catch (err) {
        setError(err as Error);
      }
    });
    const unsubscribeWsCreateEvent = gameStore.subscribe(path, 'wsCreateEvent', (data: unknown) => {
      try {
        const event = data as GameEvent;
        if (historyWrapperRef.current) {
          historyWrapperRef.current.setCreateEvent(event);
          debouncedRecomputeHistoryRef.current?.();
        }
      } catch (err) {
        setError(err as Error);
      }
    });

    gameStore.attach(path).catch((err) => {
      setError(err as Error);
    });

    // compute it here so the grid doesn't go crazy
    // Use setTimeout to avoid calling setState synchronously in effect
    setTimeout(() => {
      setScreenWidth(window.innerWidth - 1);
    }, 0);
    if (controlsRef.current) {
      setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.focus();
        }
      }, 100);
    }

    return () => {
      // Flush any pending debounced executions before cleanup
      debouncedRecomputeHistoryRef.current?.flush();
      unsubscribeWsEvent();
      unsubscribeWsCreateEvent();
      gameStore.detach(path);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]); // gameStore is stable from Zustand, doesn't need to be in deps

  // Autoplay interval effect - separate from setup/teardown
  useEffect(() => {
    if (!autoplayEnabled) {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
      return;
    }

    autoplayIntervalRef.current = setInterval(() => {
      const currentHistory = historyRef.current;
      const currentPosition = positionRef.current;
      const currentSpeed = autoplaySpeedRef.current;
      const currentHandleSetPosition = handleSetPositionRef.current;

      if (currentHistory.length > 0) {
        const lastEvent = currentHistory[currentHistory.length - 1];
        if (lastEvent && currentPosition < lastEvent.gameTimestamp) {
          currentHandleSetPosition(currentPosition + 100 * currentSpeed, true);
        } else {
          setAutoplayEnabled(false);
        }
      }
    }, 100);

    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };
  }, [autoplayEnabled]);

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
      const cursor = gameCursors.find((c: {id: number}) => c.id === followCursorRef.current);
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
      const foundCursor = gameCursors.find(
        (cursorItem: {r: number; c: number; id: number}) => cursorItem.r === r && cursorItem.c === c
      );
      if (foundCursor !== undefined) {
        followCursorRef.current = foundCursor.id;
      } else {
        followCursorRef.current = undefined;
      }
    },
    [game]
  );

  const scrubLeft = useCallback(
    ({shift = false}: {shift?: boolean} = {}): void => {
      const events = shift ? filteredHistory : history;
      const index = findLastIndex(events, (event) => event.gameTimestamp < position);
      if (!left) {
        setLeft(true);
      }
      if (index === -1) return;
      const event = events[index];
      if (event) {
        handleSetPosition(event.gameTimestamp);
      }
    },
    [position, history, filteredHistory, left, handleSetPosition]
  );

  const scrubRight = useCallback(
    ({shift = false}: {shift?: boolean} = {}): void => {
      const events = shift ? filteredHistory : history;
      const index = events.findIndex((event) => event.gameTimestamp > position);
      if (!right) {
        setRight(true);
      }
      if (index === -1) return;
      const event = events[index];
      if (event) {
        handleSetPosition(event.gameTimestamp);
      }
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

  const handleToggleAutoplay = useCallback((): void => {
    const index = history.findIndex((event) => event.gameTimestamp > position);
    if (index === -1) {
      // restart
      handleSetPosition(0);
    }
    setAutoplayEnabled((prev) => !prev);
  }, [history, position, handleSetPosition]);

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
    [scrubLeft, scrubRight, handleToggleAutoplay]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent): void => {
    e.preventDefault();
    if (e.key === 'ArrowLeft') {
      setLeft(false);
    } else if (e.key === 'ArrowRight') {
      setRight(false);
    }
  }, []);

  const renderHeader = useMemo((): React.ReactNode => {
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

  const renderToolbar = useMemo((): React.ReactNode => {
    if (!game) return undefined;
    // In replay mode, use the current replay position (in milliseconds) divided by 1000 to get seconds
    // This ensures the clock updates as the replay position changes
    const replayTime = positionToRender / 1000;
    return (
      <Toolbar
        v2
        replayMode
        gid={gid}
        mobile={isMobile()}
        pausedTime={replayTime}
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
  }, [game, gid, colorAttributionMode, listMode, positionToRender]);

  const renderPlayer = useMemo((): React.ReactNode => {
    if (error) {
      return <div>Error loading replay</div>;
    }
    if (!game) {
      return <div>Loading...</div>;
    }

    const {grid, circles, shades, cursors, clues, solved, users} = game;

    // Validate grid before accessing it
    if (!grid || !Array.isArray(grid) || grid.length === 0 || !grid[0] || !Array.isArray(grid[0])) {
      return <div>Loading grid...</div>;
    }

    // Validate clues before accessing it
    if (!clues) {
      return <div>Loading clues...</div>;
    }

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
          across: toArr(clues.across).filter((c): c is string => c !== undefined),
          down: toArr(clues.down).filter((c): c is string => c !== undefined),
        }}
        cursors={cursors}
        frozen={solved}
        myColor={myColor}
        updateGrid={() => {}}
        updateCursor={handleUpdateCursor}
        onPressEnter={() => {}}
        mobile={isMobile()}
        users={users}
        colorAttributionMode={colorAttributionMode}
        listMode={listMode}
      />
    );
  }, [error, game, colorAttributionMode, listMode, handleUpdateCursor, screenWidth, myColor]);

  const renderControls = useMemo((): React.ReactNode => {
    const width = isMobile() ? screenWidth - 20 : 1000;

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
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        {history.length > 0 ? (
          <Timeline width={width} history={history} position={position} onSetPosition={handleSetPosition} />
        ) : null}
        <div className="replay--control-icons">
          <MdChevronLeft
            className={`scrub ${left ? 'active' : ''}`}
            onMouseDown={handleMouseDownLeft}
            onMouseUp={handleMouseUpLeft}
            onTouchStart={handleMouseDownLeft}
            onTouchEnd={handleMouseUpLeft}
            onMouseLeave={handleMouseUpLeft}
          />
          <div
            className="scrub--autoplay"
            onClick={handleToggleAutoplay}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleAutoplay();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Toggle autoplay"
          >
            {autoplayEnabled && <MdPause />}
            {!autoplayEnabled && <MdPlayArrow />}
          </div>
          <Tooltip title="Shortcut: Right Arrow">
            <MdChevronRight
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
              {formatTime(position / 1000)} /{' '}
              {formatTime((history[history.length - 1]?.gameTimestamp ?? 0) / 1000)}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setAutoplaySpeed(speed);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Set autoplay speed to ${speed}x`}
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
    screenWidth,
  ]);

  const puzzleTitle = useMemo((): string => {
    if (!game || !game.info) return '';
    return game.info.title;
  }, [game]);

  // Set document title
  useEffect(() => {
    const title = puzzleTitle ? `Replay ${gid}: ${puzzleTitle}` : `Replay ${gid}`;
    document.title = title;
    return () => {
      document.title = 'Cross with Friends';
    };
  }, [gid, puzzleTitle]);

  return (
    <Stack direction="column" className="replay">
      {/* @ts-expect-error - Nav component has incompatible React type definitions */}
      {!isMobile() && <Nav v2 />}
      {!isMobile() && (
        <div
          style={{
            paddingLeft: 30,
            paddingTop: 20,
            paddingBottom: 20,
          }}
        >
          {renderHeader}
        </div>
      )}
      {renderToolbar}
      <Stack
        direction="column"
        sx={{
          flex: 1,
          padding: isMobile() ? 0 : 1.25,
          border: '1px solid #E2E2E2',
        }}
      >
        <Box sx={{flex: 1, padding: isMobile() ? 0 : 2.5}}>{renderPlayer}</Box>
        <div
          style={{
            zIndex: 1,
            // flex: 1,
          }}
        >
          {renderControls}
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
