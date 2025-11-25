import {toHex, darken, GREENISH} from '@crosswithfriends/shared/lib/colors';
import {toArr} from '@crosswithfriends/shared/lib/jsUtils';
import * as powerups from '@crosswithfriends/shared/lib/powerups';
import GridWrapper from '@crosswithfriends/shared/lib/wrappers/GridWrapper';
import {Box, Stack} from '@mui/material';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';

import {useGameStore} from '../../store/gameStore';
import type {Powerup, Pickup} from '../../types/battle';
import {logger} from '../../utils/logger';
import Player from '../Player';
import Toolbar from '../Toolbar';

import Confetti from './Confetti';
import PuzzleInfo from './PuzzleInfo';

const vimModeKey = 'vim-mode';
const vimModeRegex = /^\d+(a|d)*$/;

interface GameModel {
  updateCell: (
    r: number,
    c: number,
    id: string,
    color: string,
    pencil: boolean,
    value: string,
    autocheck: boolean
  ) => void;
  updateCursor: (r: number, c: number, id: string) => void;
  addPing: (r: number, c: number, id: string) => void;
  updateColor: (id: string, color: string) => void;
  updateClock: (action: string) => void;
  check: (scope: {r: number; c: number}[]) => void;
  reveal: (scope: {r: number; c: number}[]) => void;
  reset: (scope: {r: number; c: number}[], force: boolean) => void;
  chat: (username: string, id: string, text: string) => void;
}

interface BattleModel {
  checkPickups: (r: number, c: number, game: unknown, team: number) => void;
}

interface GameProps {
  ownPowerups?: Powerup[];
  opponentPowerups?: Powerup[];
  gameModel: GameModel | null;
  id: string;
  myColor: string;
  onChange: (options?: {isEdit?: boolean}) => void;
  battleModel?: BattleModel | null;
  team?: number;
  onToggleChat: () => void;
  onUnfocus: () => void;
  mobile?: boolean;
  beta?: boolean;
  gid?: string;
  pickups?: Record<string, Pickup>;
  unreads?: number;
  scrollToBottomTrigger?: number;
}

// component for gameplay -- incl. grid/clues & toolbar
const Game: React.FC<GameProps> = (props) => {
  // Destructure props to avoid dependency issues
  const {
    id,
    myColor,
    gameModel,
    onChange,
    battleModel,
    team,
    onToggleChat,
    onUnfocus,
    ownPowerups,
    opponentPowerups,
    gid,
    pickups,
    unreads,
    scrollToBottomTrigger,
    mobile,
    beta,
  } = props;

  const [listMode, setListMode] = useState<boolean>(false);
  const [pencilMode, setPencilMode] = useState<boolean>(false);
  const [autocheckMode, setAutocheckMode] = useState<boolean>(false);
  const [vimMode, setVimMode] = useState<boolean>(false);
  const [vimInsert, setVimInsert] = useState<boolean>(false);
  const [vimCommand, setVimCommand] = useState<boolean>(false);
  const [colorAttributionMode, setColorAttributionMode] = useState<boolean>(false);
  const [expandMenu, setExpandMenu] = useState<boolean>(false);

  const playerRef = useRef<{
    getSelectedSquares: () => unknown[];
    getSelectedAndHighlightedSquares: () => unknown[];
    getAllSquares: () => unknown[];
    selectClue: (direction: string, number: number) => void;
    focus: () => void;
  } | null>(null);
  const prevMyColorRef = useRef<string | undefined>(myColor);

  useEffect(() => {
    let vimModeValue = false;
    try {
      vimModeValue = JSON.parse(localStorage.getItem(vimModeKey) || 'false') || false;
    } catch (error) {
      logger.errorWithException('Failed to parse local storage vim mode', error);
    }
    // Use setTimeout to avoid calling setState synchronously in effect
    setTimeout(() => {
      setVimMode(vimModeValue);
    }, 0);
  }, []);

  const handleUpdateColor = useCallback(
    (userId: string, color: string) => {
      if (!gameModel) return;
      gameModel.updateColor(userId, color);
    },
    [gameModel]
  );

  useEffect(() => {
    if (prevMyColorRef.current !== myColor && gameModel) {
      handleUpdateColor(id, myColor);
      prevMyColorRef.current = myColor;
    }
  }, [myColor, id, gameModel, handleUpdateColor]);

  // Use Zustand store as primary source
  const gamePath = gid ? `/game/${gid}` : '';
  const rawGame = useGameStore((state) => state.games[gamePath]?.gameState ?? null);
  const createEvent = useGameStore((state) => state.games[gamePath]?.createEvent ?? null);
  const gameReady = useGameStore((state) => state.games[gamePath]?.ready ?? false);

  // Debug: Check if create event has grid data
  useEffect(() => {
    if (createEvent && createEvent.type === 'create' && createEvent.params?.game) {
      const createGame = createEvent.params.game as {grid?: unknown};
      if (!createGame.grid || (Array.isArray(createGame.grid) && createGame.grid.length === 0)) {
        logger.error('Game create event missing or empty grid', {createGame});
      } else {
        logger.debug('Game create event has grid', {
          hasGrid: !!createGame.grid,
          gridLength: Array.isArray(createGame.grid) ? createGame.grid.length : 'not array',
          grid0Length:
            Array.isArray(createGame.grid) && createGame.grid[0] ? createGame.grid[0].length : 'N/A',
        });
      }
    }
  }, [createEvent]);

  // Debug: Check if rawGame has grid data
  useEffect(() => {
    if (rawGame) {
      const hasGrid = !!rawGame.grid;
      const gridLength = Array.isArray(rawGame.grid) ? rawGame.grid.length : 'not array';
      const grid0Length = Array.isArray(rawGame.grid) && rawGame.grid[0] ? rawGame.grid[0].length : 'N/A';
      logger.debug('Game rawGame state', {
        hasGrid,
        gridLength,
        grid0Length,
        ready: gameReady,
        hasCreateEvent: !!createEvent,
      });
      if (!hasGrid || (Array.isArray(rawGame.grid) && rawGame.grid.length === 0)) {
        logger.error('Game rawGame missing or empty grid', {
          rawGame,
          createEvent: createEvent ? {type: createEvent.type, hasParams: !!createEvent.params} : null,
        });
      }
    } else {
      logger.debug('Game rawGame is null', {ready: gameReady, hasCreateEvent: !!createEvent});
    }
  }, [rawGame, gameReady, createEvent]);

  // Opponent game state would come from a separate hook if needed
  // For now, opponent game effects are handled via powerups
  const rawOpponentGame = null;

  // TODO: this should be cached, sigh...
  const games = useMemo(() => {
    const result = powerups.apply(rawGame, rawOpponentGame, ownPowerups, opponentPowerups);
    logger.debug('Game powerups.apply result', {
      hasOwnGame: !!result.ownGame,
      hasOpponentGame: !!result.opponentGame,
      ownGameGrid: result.ownGame?.grid
        ? {
            exists: true,
            length: Array.isArray(result.ownGame.grid) ? result.ownGame.grid.length : 'not array',
            grid0Length:
              Array.isArray(result.ownGame.grid) && result.ownGame.grid[0]
                ? result.ownGame.grid[0].length
                : 'N/A',
          }
        : {exists: false},
    });
    return result;
  }, [rawGame, rawOpponentGame, ownPowerups, opponentPowerups]);

  const game = useMemo(() => {
    const result = games.ownGame;
    if (result) {
      logger.debug('Game final game state', {
        hasGrid: !!result.grid,
        gridLength: Array.isArray(result.grid) ? result.grid.length : 'not array',
        grid0Length: Array.isArray(result.grid) && result.grid[0] ? result.grid[0].length : 'N/A',
      });
    }
    return result;
  }, [games]);

  const opponentGame = useMemo(() => {
    return games.opponentGame;
  }, [games]);

  const scope = useCallback(
    (s: string) => {
      logger.debug('Game scope function called', {
        scope: s,
        hasPlayerRef: !!playerRef.current,
        hasGame: !!game,
        hasGrid: !!game?.grid,
        gridLength: game?.grid?.length,
      });

      // For "puzzle" scope, we can get all squares from the grid even if playerRef is null
      if (s === 'puzzle' && game?.grid) {
        try {
          const gridObj = new GridWrapper(game.grid);
          const allSquares: Array<{r: number; c: number}> = [];
          const keys = gridObj.keys();
          keys.forEach(([r, c]) => {
            if (gridObj.isWhite(r, c)) {
              allSquares.push({r, c});
            }
          });
          logger.debug('Game getAllSquares from grid returned', {squareCount: allSquares.length});
          return allSquares;
        } catch (error) {
          logger.errorWithException('Error getting squares from grid', error);
          // Fallback: try direct grid access
          const allSquares: Array<{r: number; c: number}> = [];
          if (Array.isArray(game.grid)) {
            for (let r = 0; r < game.grid.length; r++) {
              if (Array.isArray(game.grid[r])) {
                for (let c = 0; c < game.grid[r].length; c++) {
                  const cell = game.grid[r][c];
                  if (cell && typeof cell === 'object' && !cell.black) {
                    allSquares.push({r, c});
                  }
                }
              }
            }
          }
          logger.debug('Game fallback getAllSquares returned', {squareCount: allSquares.length});
          return allSquares;
        }
      }

      // For other scopes, we need playerRef
      if (!playerRef.current) {
        logger.warn('Game scope early return - playerRef.current is null', {scope: s});
        return [];
      }

      let result: Array<{r: number; c: number}> = [];
      if (s === 'square') {
        result = playerRef.current.getSelectedSquares();
        logger.debug('Game getSelectedSquares returned', {resultCount: result.length});
      } else if (s === 'word') {
        result = playerRef.current.getSelectedAndHighlightedSquares();
        logger.debug('Game getSelectedAndHighlightedSquares returned', {resultCount: result.length});
      } else if (s === 'puzzle') {
        result = playerRef.current.getAllSquares();
        logger.debug('Game getAllSquares returned', {resultCount: result.length});
      } else {
        logger.warn('Game scope unknown scope string', {scope: s});
      }
      return result;
    },
    [game]
  );

  const handleUpdateGrid = useCallback(
    (r: number, c: number, value: string) => {
      if (!gameModel) {
        logger.warn('handleUpdateGrid called but gameModel is not available', {r, c, value});
        return;
      }
      gameModel.updateCell(r, c, id, myColor, pencilMode, value, autocheckMode);
      onChange({isEdit: true});
      if (battleModel) {
        battleModel.checkPickups(r, c, rawGame, team);
      }
    },
    [id, myColor, gameModel, onChange, battleModel, team, pencilMode, autocheckMode, rawGame]
  );

  const handleUpdateCursor = useCallback(
    ({r, c}: {r: number; c: number}) => {
      if (!gameModel) return;
      if (game.solved && !game.cursors.find((cursor) => cursor.id === id)) {
        return;
      }
      gameModel.updateCursor(r, c, id);
    },
    [id, gameModel, game]
  );

  const handleAddPing = useCallback(
    ({r, c}: {r: number; c: number}) => {
      if (!gameModel) return;
      gameModel.addPing(r, c, id);
    },
    [id, gameModel]
  );

  const handleStartClock = useCallback(() => {
    if (!gameModel) return;
    gameModel.updateClock('start');
  }, [gameModel]);

  const handlePauseClock = useCallback(() => {
    if (!gameModel) return;
    gameModel.updateClock('pause');
  }, [gameModel]);

  const handleResetClock = useCallback(() => {
    if (!gameModel) return;
    gameModel.updateClock('reset');
  }, [gameModel]);

  const handleCheck = useCallback(
    (scopeString: string) => {
      logger.debug('Game handleCheck called', {
        scopeString,
        hasGameModel: !!gameModel,
        gameModelReady: gameModel?.ready,
        hasGame: !!game,
      });
      if (!gameModel || !game || !gameModel.ready) {
        logger.warn('Game handleCheck early return', {
          hasGameModel: !!gameModel,
          hasGame: !!game,
          ready: gameModel?.ready,
        });
        return;
      }
      const scopeValue = scope(scopeString);
      logger.debug('Game scope function returned', {scopeValueLength: scopeValue.length});
      if (scopeValue.length === 0) {
        logger.warn('Game handleCheck early return - scopeValue is empty');
        return;
      }
      logger.debug('Calling gameModel.check', {scopeValueLength: scopeValue.length});
      gameModel.check(scopeValue);
    },
    [gameModel, scope, game]
  );

  const handleReveal = useCallback(
    (scopeString: string) => {
      logger.debug('Game handleReveal called', {
        scopeString,
        hasGameModel: !!gameModel,
        gameModelReady: gameModel?.ready,
        hasGame: !!game,
      });
      if (!gameModel || !game || !gameModel.ready) {
        logger.warn('Game handleReveal early return', {
          hasGameModel: !!gameModel,
          hasGame: !!game,
          ready: gameModel?.ready,
        });
        return;
      }
      const scopeValue = scope(scopeString);
      logger.debug('Game scope function returned', {scopeValueLength: scopeValue.length});
      if (scopeValue.length === 0) {
        logger.warn('Game handleReveal early return - scopeValue is empty');
        return;
      }
      logger.debug('Calling gameModel.reveal', {scopeValueLength: scopeValue.length});
      gameModel.reveal(scopeValue);
      onChange();
    },
    [gameModel, onChange, scope, game]
  );

  const handleReset = useCallback(
    (scopeString: string, force: boolean = false) => {
      logger.debug('Game handleReset called', {
        scopeString,
        force,
        hasGameModel: !!gameModel,
        gameModelReady: gameModel?.ready,
        hasGame: !!game,
      });
      if (!gameModel || !game || !gameModel.ready) {
        logger.warn('Game handleReset early return', {
          hasGameModel: !!gameModel,
          hasGame: !!game,
          ready: gameModel?.ready,
        });
        return;
      }
      const scopeValue = scope(scopeString);
      logger.debug('Game scope function returned', {scopeValueLength: scopeValue.length});
      if (scopeValue.length === 0) {
        logger.warn('Game handleReset early return - scopeValue is empty');
        return;
      }
      logger.debug('Calling gameModel.reset', {scopeValueLength: scopeValue.length, force});
      gameModel.reset(scopeValue, force);
    },
    [gameModel, scope, game]
  );

  const handleKeybind = useCallback((mode: string) => {
    setVimMode(mode === 'vim');
  }, []);

  const handleToggleVimMode = useCallback(() => {
    setVimMode((prev) => {
      const newVimMode = !prev;
      localStorage.setItem(vimModeKey, JSON.stringify(newVimMode));
      return newVimMode;
    });
  }, []);

  const handleVimInsert = useCallback(() => {
    setVimInsert(true);
  }, []);

  const handleVimCommand = useCallback(() => {
    setVimCommand((prev) => !prev);
  }, []);

  const handleVimNormal = useCallback(() => {
    setVimInsert(false);
    setVimCommand(false);
  }, []);

  const handleTogglePencil = useCallback(() => {
    setPencilMode((prev) => !prev);
  }, []);

  const handleToggleAutocheck = useCallback(() => {
    setAutocheckMode((prev) => !prev);
  }, []);

  const handleToggleListView = useCallback(() => {
    setListMode((prev) => !prev);
  }, []);

  const handleToggleChat = useCallback(() => {
    onToggleChat();
  }, [onToggleChat]);

  const handleToggleExpandMenu = useCallback(() => {
    setExpandMenu((prev) => !prev);
  }, []);

  const focus = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.focus();
    }
  }, []);

  const handleRefocus = useCallback(() => {
    focus();
  }, [focus]);

  const handlePressPeriod = handleTogglePencil;

  const handleVimCommandPressEnter = useCallback(
    (command: string) => {
      if (vimModeRegex.test(command)) {
        let dir = 'across';
        const int = parseInt(command, 10);
        if (command.endsWith('d')) {
          dir = 'down';
        }
        if (playerRef.current) {
          playerRef.current.selectClue(dir, int);
        }
      }
      handleRefocus();
    },
    [handleRefocus]
  );

  const handlePressEnter = useCallback(() => {
    onUnfocus();
  }, [onUnfocus]);

  const _handleSelectClue = useCallback((direction: string, number: number) => {
    if (playerRef.current) {
      playerRef.current.selectClue(direction, number);
    }
  }, []);

  // Memoize clues transformation to avoid side effects in render
  const clues = useMemo(() => {
    if (!game) return {across: [], down: []};
    const result = {
      ...game.clues,
    };
    // Only access window.location in useMemo, not during render
    if (
      typeof window !== 'undefined' &&
      (window.location.host === 'foracross.com' || window.location.host.includes('.foracross.com'))
    ) {
      const dirToHide = window.location.host.includes('down') ? 'across' : 'down';
      result[dirToHide] = [...result[dirToHide]].map((val) => val && '-');
    }
    return result;
  }, [game]);

  // Track actual container dimensions for responsive grid sizing
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Use ResizeObserver to track actual container dimensions
    // contentRect excludes padding, which is what we want for grid sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    // Measure initial dimensions
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(containerRef.current);
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const width = rect.width - paddingLeft - paddingRight;
        const height = rect.height - paddingTop - paddingBottom;
        setContainerWidth(width);
        setContainerHeight(height);
      }
    };

    resizeObserver.observe(containerRef.current);
    updateDimensions(); // Initial measurement

    // Fallback to window resize for older browsers
    const handleResize = () => {
      updateDimensions();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Scroll to bottom when trigger changes
  useEffect(() => {
    if (scrollToBottomTrigger && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [scrollToBottomTrigger]);

  // Use actual container width, fallback to window width if not measured yet
  const screenWidth = useMemo(() => {
    if (containerWidth > 0) {
      return containerWidth;
    }
    // Fallback calculation for initial render
    // On desktop (sm and above), game takes 75% when chat is visible, 100% when collapsed
    // On mobile, game takes full width
    if (typeof window !== 'undefined') {
      const windowWidth = window.innerWidth;
      const isSmallScreen = windowWidth < 600; // xs breakpoint

      if (isSmallScreen) {
        // Mobile: full width minus padding
        const padding = 20;
        return windowWidth - padding;
      } else {
        // Desktop: assume chat is visible (75% of width) for initial calculation
        // ResizeObserver will update this when container is measured
        const padding = 40;
        const gameWidth = windowWidth * 0.75; // 75% for game, 25% for chat
        return gameWidth - padding;
      }
    }
    return 0;
  }, [containerWidth]);

  const renderPlayer = useCallback(() => {
    if (!game) {
      return <div>Loading...</div>;
    }

    const {
      grid,
      circles,
      shades,
      cursors,
      pings,
      users,
      solved,
      solution,
      themeColor,
      optimisticCounter,
      clues,
    } = game;

    // Basic validation - check if grid exists and is an array
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
      logger.warn('Game renderPlayer: grid validation failed', {
        hasGrid: !!grid,
        isArray: Array.isArray(grid),
        length: grid?.length,
      });
      return <div>Loading grid...</div>;
    }

    // Check if grid[0] exists and is an array
    if (!grid[0] || !Array.isArray(grid[0])) {
      logger.warn('Game renderPlayer: grid[0] validation failed', {
        hasGrid0: !!grid[0],
        isArray: Array.isArray(grid[0]),
      });
      return <div>Loading grid...</div>;
    }

    const opponentGrid = opponentGame && opponentGame.grid;
    const themeStyles = {
      clueBarStyle: {
        backgroundColor: toHex(themeColor),
      },
      gridStyle: {
        cellStyle: {
          selected: {
            backgroundColor: myColor,
          },
          highlighted: {
            backgroundColor: toHex(darken(themeColor)),
          },
          frozen: {
            backgroundColor: toHex(GREENISH),
          },
        },
      },
    };
    const cols = grid[0].length;
    const rows = grid.length;

    // Calculate available dimensions
    // Account for clue bar height (~60px), gap (10px), and padding/margins (~40px total)
    const clueBarHeight = 60;
    const gap = 10;
    const verticalPadding = 40;
    const availableWidth = screenWidth > 0 ? Math.max(screenWidth * 0.9, 200) : window.innerWidth - 100;

    // Use container height if available, otherwise estimate from viewport
    // Subtract toolbar (~60px), puzzle info (~60px), clue bar, gap, and padding
    const estimatedToolbarHeight = 60;
    const estimatedPuzzleInfoHeight = 60;
    const totalVerticalOffset =
      estimatedToolbarHeight + estimatedPuzzleInfoHeight + clueBarHeight + gap + verticalPadding;

    const availableHeight =
      containerHeight > 0
        ? containerHeight - clueBarHeight - gap - verticalPadding
        : window.innerHeight - totalVerticalOffset;

    // Calculate size based on both width and height, use the smaller to ensure it fits
    const sizeByWidth = availableWidth / cols;
    const sizeByHeight = availableHeight / rows;

    // Use the smaller dimension to ensure grid fits in both directions
    const maxCellSize = 35;
    const minSize = mobile ? 1 : 20;
    const calculatedSize = Math.min(sizeByWidth, sizeByHeight);

    // For mini puzzles (5x5 or smaller), allow larger cells to fill the space better
    // For standard puzzles, cap at 35px per cell
    const maxAllowedSize = cols <= 5 ? 80 : maxCellSize;
    const size = Math.max(minSize, Math.min(calculatedSize, maxAllowedSize));
    return (
      <Player
        ref={playerRef}
        beta={beta}
        size={size}
        grid={grid}
        solution={solution}
        opponentGrid={opponentGrid}
        circles={circles}
        shades={shades}
        clues={{
          across: toArr(clues?.across || []),
          down: toArr(clues?.down || []),
        }}
        id={id}
        cursors={cursors}
        pings={pings}
        users={users}
        frozen={solved}
        myColor={myColor}
        updateGrid={handleUpdateGrid}
        updateCursor={handleUpdateCursor}
        addPing={handleAddPing}
        onPressEnter={handlePressEnter}
        onPressPeriod={handlePressPeriod}
        listMode={listMode}
        vimMode={vimMode}
        vimInsert={vimInsert}
        vimCommand={vimCommand}
        onVimInsert={handleVimInsert}
        onVimNormal={handleVimNormal}
        onVimCommand={handleVimCommand}
        onVimCommandPressEnter={handleVimCommandPressEnter}
        onVimCommandPressEscape={handleRefocus}
        colorAttributionMode={colorAttributionMode}
        mobile={mobile}
        pickups={pickups}
        optimisticCounter={optimisticCounter}
        onCheck={handleCheck}
        onReveal={handleReveal}
        {...themeStyles}
      />
    );
  }, [
    id,
    myColor,
    mobile,
    beta,
    game,
    opponentGame,
    clues,
    screenWidth,
    containerHeight,
    listMode,
    vimMode,
    vimInsert,
    vimCommand,
    colorAttributionMode,
    pickups,
    handleUpdateGrid,
    handleUpdateCursor,
    handleAddPing,
    handlePressEnter,
    handlePressPeriod,
    handleVimInsert,
    handleVimNormal,
    handleVimCommand,
    handleVimCommandPressEnter,
    handleRefocus,
    handleCheck,
    handleReveal,
  ]);

  const renderToolbar = useCallback(() => {
    if (!game) return null;
    const {clock, solved} = game;
    const {lastUpdated: startTime, totalTime: pausedTime, paused: isPaused} = clock;
    return (
      <Toolbar
        v2
        gid={gid}
        pid={game.pid}
        mobile={mobile}
        startTime={startTime}
        pausedTime={pausedTime}
        isPaused={isPaused}
        listMode={listMode}
        expandMenu={expandMenu}
        pencilMode={pencilMode}
        autocheckMode={autocheckMode}
        vimMode={vimMode}
        solved={solved}
        vimInsert={vimInsert}
        vimCommand={vimCommand}
        onStartClock={handleStartClock}
        onPauseClock={handlePauseClock}
        onResetClock={handleResetClock}
        onCheck={handleCheck}
        onReveal={handleReveal}
        onReset={handleReset}
        onKeybind={handleKeybind}
        onTogglePencil={handleTogglePencil}
        onToggleVimMode={handleToggleVimMode}
        onToggleAutocheck={handleToggleAutocheck}
        onToggleListView={handleToggleListView}
        onToggleChat={handleToggleChat}
        onToggleExpandMenu={handleToggleExpandMenu}
        colorAttributionMode={colorAttributionMode}
        onToggleColorAttributionMode={() => {
          setColorAttributionMode((prev) => !prev);
        }}
        onRefocus={handleRefocus}
        unreads={unreads}
      />
    );
  }, [
    game,
    mobile,
    gid,
    unreads,
    listMode,
    expandMenu,
    pencilMode,
    autocheckMode,
    vimMode,
    vimInsert,
    vimCommand,
    colorAttributionMode,
    handleStartClock,
    handlePauseClock,
    handleResetClock,
    handleCheck,
    handleReveal,
    handleReset,
    handleKeybind,
    handleTogglePencil,
    handleToggleVimMode,
    handleToggleAutocheck,
    handleToggleListView,
    handleToggleChat,
    handleToggleExpandMenu,
    handleRefocus,
  ]);

  return (
    <Stack
      direction="column"
      sx={{flex: 1, height: '100%', maxHeight: '100%', overflow: 'hidden', minHeight: 0}}
    >
      {renderToolbar()}
      {game && game.info && (
        <Box sx={{padding: {xs: '8px', sm: '12px 16px'}, flexShrink: 0}}>
          <PuzzleInfo
            title={game.info.title || 'Untitled Puzzle'}
            author={game.info.author || 'Unknown'}
            type={game.info.type}
            pid={game.pid}
            gid={gid}
          />
        </Box>
      )}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          padding: {xs: 0, sm: 1, md: 2, lg: 3},
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
          minHeight: 0,
          maxHeight: '100%',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            minHeight: 0,
          }}
        >
          {renderPlayer()}
        </Box>
      </Box>
      {game && game.solved && <Confetti />}
    </Stack>
  );
};

export default Game;
