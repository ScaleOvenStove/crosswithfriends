import {toHex, darken, GREENISH} from '@crosswithfriends/shared/lib/colors';
import {toArr} from '@crosswithfriends/shared/lib/jsUtils';
import * as powerups from '@crosswithfriends/shared/lib/powerups';
import {Box, Stack} from '@mui/material';
import _ from 'lodash';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';

import {useGameStore} from '../../store/gameStore';
import type {Powerup, Pickup} from '../../types/battle';
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
  const prevMyColorRef = useRef<string | undefined>(props.myColor);

  useEffect(() => {
    let vimModeValue = false;
    try {
      vimModeValue = JSON.parse(localStorage.getItem(vimModeKey) || 'false') || false;
    } catch {
      console.error('Failed to parse local storage vim mode!');
    }
    setVimMode(vimModeValue);
  }, []);

  const handleUpdateColor = useCallback(
    (id: string, color: string) => {
      if (!props.gameModel) return;
      props.gameModel.updateColor(id, color);
    },
    [props.gameModel]
  );

  useEffect(() => {
    if (prevMyColorRef.current !== props.myColor && props.gameModel) {
      handleUpdateColor(props.id, props.myColor);
      prevMyColorRef.current = props.myColor;
    }
  }, [props.myColor, props.id, props.gameModel, handleUpdateColor]);

  // Use Zustand store as primary source
  const gamePath = props.gid ? `/game/${props.gid}` : '';
  const rawGame = useGameStore((state) => state.games[gamePath]?.gameState ?? null);

  // Opponent game state would come from a separate hook if needed
  // For now, opponent game effects are handled via powerups
  const rawOpponentGame = null;

  // TODO: this should be cached, sigh...
  const games = useMemo(() => {
    return powerups.apply(rawGame, rawOpponentGame, props.ownPowerups, props.opponentPowerups);
  }, [rawGame, rawOpponentGame, props.ownPowerups, props.opponentPowerups]);

  const game = useMemo(() => {
    return games.ownGame;
  }, [games]);

  const opponentGame = useMemo(() => {
    return games.opponentGame;
  }, [games]);

  const scope = useCallback((s: string) => {
    console.log('[Game] scope function called with:', s);
    console.log('[Game] playerRef.current exists:', !!playerRef.current);
    if (!playerRef.current) {
      console.warn('[Game] scope early return - playerRef.current is null');
      return [];
    }
    let result: Array<{r: number; c: number}> = [];
    if (s === 'square') {
      result = playerRef.current.getSelectedSquares();
      console.log('[Game] getSelectedSquares returned:', result);
    } else if (s === 'word') {
      result = playerRef.current.getSelectedAndHighlightedSquares();
      console.log('[Game] getSelectedAndHighlightedSquares returned:', result);
    } else if (s === 'puzzle') {
      result = playerRef.current.getAllSquares();
      console.log('[Game] getAllSquares returned:', result);
    } else {
      console.warn('[Game] scope unknown scope string:', s);
    }
    return result;
  }, []);

  const handleUpdateGrid = useCallback(
    (r: number, c: number, value: string) => {
      if (!props.gameModel) {
        console.warn('handleUpdateGrid called but gameModel is not available');
        return;
      }
      const {id, myColor} = props;
      props.gameModel.updateCell(r, c, id, myColor, pencilMode, value, autocheckMode);
      props.onChange({isEdit: true});
      if (props.battleModel) {
        props.battleModel.checkPickups(r, c, rawGame, props.team);
      }
    },
    [
      props.id,
      props.myColor,
      props.gameModel,
      props.onChange,
      props.battleModel,
      props.team,
      pencilMode,
      autocheckMode,
      rawGame,
    ]
  );

  const handleUpdateCursor = useCallback(
    ({r, c}: {r: number; c: number}) => {
      if (!props.gameModel) return;
      const {id} = props;
      if (game.solved && !_.find(game.cursors, (cursor: any) => cursor.id === id)) {
        return;
      }
      props.gameModel.updateCursor(r, c, id);
    },
    [props.id, props.gameModel, game]
  );

  const handleAddPing = useCallback(
    ({r, c}: {r: number; c: number}) => {
      if (!props.gameModel) return;
      const {id} = props;
      props.gameModel.addPing(r, c, id);
    },
    [props.id, props.gameModel]
  );

  const handleStartClock = useCallback(() => {
    if (!props.gameModel) return;
    props.gameModel.updateClock('start');
  }, [props.gameModel]);

  const handlePauseClock = useCallback(() => {
    if (!props.gameModel) return;
    props.gameModel.updateClock('pause');
  }, [props.gameModel]);

  const handleResetClock = useCallback(() => {
    if (!props.gameModel) return;
    props.gameModel.updateClock('reset');
  }, [props.gameModel]);

  const handleCheck = useCallback(
    (scopeString: string) => {
      console.log('[Game] handleCheck called with scopeString:', scopeString);
      console.log('[Game] props.gameModel exists:', !!props.gameModel);
      console.log('[Game] props.gameModel?.ready:', props.gameModel?.ready);
      console.log('[Game] game exists:', !!game);
      if (!props.gameModel || !game || !props.gameModel.ready) {
        console.warn(
          '[Game] handleCheck early return - gameModel:',
          !!props.gameModel,
          'game:',
          !!game,
          'ready:',
          props.gameModel?.ready
        );
        return;
      }
      const scopeValue = scope(scopeString);
      console.log('[Game] scope function returned:', scopeValue);
      if (scopeValue.length === 0) {
        console.warn('[Game] handleCheck early return - scopeValue is empty');
        return;
      }
      console.log('[Game] Calling gameModel.check with scopeValue:', scopeValue);
      props.gameModel.check(scopeValue);
    },
    [props.gameModel, scope, game]
  );

  const handleReveal = useCallback(
    (scopeString: string) => {
      console.log('[Game] handleReveal called with scopeString:', scopeString);
      console.log('[Game] props.gameModel exists:', !!props.gameModel);
      console.log('[Game] props.gameModel?.ready:', props.gameModel?.ready);
      console.log('[Game] game exists:', !!game);
      if (!props.gameModel || !game || !props.gameModel.ready) {
        console.warn(
          '[Game] handleReveal early return - gameModel:',
          !!props.gameModel,
          'game:',
          !!game,
          'ready:',
          props.gameModel?.ready
        );
        return;
      }
      const scopeValue = scope(scopeString);
      console.log('[Game] scope function returned:', scopeValue);
      if (scopeValue.length === 0) {
        console.warn('[Game] handleReveal early return - scopeValue is empty');
        return;
      }
      console.log('[Game] Calling gameModel.reveal with scopeValue:', scopeValue);
      props.gameModel.reveal(scopeValue);
      props.onChange();
    },
    [props.gameModel, props.onChange, scope, game]
  );

  const handleReset = useCallback(
    (scopeString: string, force: boolean = false) => {
      console.log('[Game] handleReset called with scopeString:', scopeString, 'force:', force);
      console.log('[Game] props.gameModel exists:', !!props.gameModel);
      console.log('[Game] props.gameModel?.ready:', props.gameModel?.ready);
      console.log('[Game] game exists:', !!game);
      if (!props.gameModel || !game || !props.gameModel.ready) {
        console.warn(
          '[Game] handleReset early return - gameModel:',
          !!props.gameModel,
          'game:',
          !!game,
          'ready:',
          props.gameModel?.ready
        );
        return;
      }
      const scopeValue = scope(scopeString);
      console.log('[Game] scope function returned:', scopeValue);
      if (scopeValue.length === 0) {
        console.warn('[Game] handleReset early return - scopeValue is empty');
        return;
      }
      console.log('[Game] Calling gameModel.reset with scopeValue:', scopeValue, 'force:', force);
      props.gameModel.reset(scopeValue, force);
    },
    [props.gameModel, scope, game]
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
    props.onToggleChat();
  }, [props.onToggleChat]);

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
    props.onUnfocus();
  }, [props.onUnfocus]);

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
      result[dirToHide] = _.assign([], result[dirToHide]).map((val) => val && '-');
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
    if (props.scrollToBottomTrigger && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [props.scrollToBottomTrigger]);

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
    const {id, myColor, mobile, beta} = props;
    if (!game) {
      return <div>Loading...</div>;
    }

    const {grid, circles, shades, cursors, pings, users, solved, solution, themeColor, optimisticCounter} =
      game;
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
    const minSize = props.mobile ? 1 : 20;
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
        pickups={props.pickups}
        optimisticCounter={optimisticCounter}
        onCheck={handleCheck}
        onReveal={handleReveal}
        {...themeStyles}
      />
    );
  }, [
    props,
    game,
    opponentGame,
    clues,
    screenWidth,
    containerHeight,
    listMode,
    pencilMode,
    vimMode,
    vimInsert,
    vimCommand,
    colorAttributionMode,
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
    const {mobile, gid, unreads} = props;
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
    props.mobile,
    props.gid,
    props.unreads,
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
            gid={props.gid}
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
