import {isMobile, rand_color} from '@crosswithfriends/shared/lib/jsUtils';
import nameGenerator from '@crosswithfriends/shared/lib/nameGenerator';
import * as powerupLib from '@crosswithfriends/shared/lib/powerups';
import {Box, Stack, IconButton, Alert, Snackbar} from '@mui/material';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Helmet} from 'react-helmet';
import {MdChevronLeft} from 'react-icons/md';
import {useParams} from 'react-router-dom';

type DebouncedFunc<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): Promise<void>;
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => Promise<void>>(
  fn: T,
  delay: number = 0
): DebouncedFunc<T> => {
  let timeout: NodeJS.Timeout;
  const debounced = (...args: Parameters<T>): Promise<void> => {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => {
        fn(...args).then(resolve);
      }, delay);
    });
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};

import Chat from '../components/Chat';
import GameSkeletonLoader from '../components/common/GameSkeletonLoader';
import MobilePanel from '../components/common/MobilePanel';
import Nav from '../components/common/Nav';
import Powerups from '../components/common/Powerups';
import GameComponent from '../components/Game';
import {useRecordSolve} from '../hooks/api/useRecordSolve';
import {useBattleSetup} from '../hooks/useBattleSetup';
import {useGameSetup} from '../hooks/useGameSetup';
import {useUser} from '../hooks/useUser';
import {isValidGid, createSafePath} from '../store/firebaseUtils';
import type {Powerup, Winner, BattlePlayer, Pickup, BattleData} from '../types/battle';
import {logger} from '../utils/logger';

// Consolidate battle-related state
interface BattleState {
  bid: number | undefined;
  team: number | undefined;
  opponent: string | undefined;
  startedAt: number | undefined;
  winner: Winner | undefined;
  players: Record<string, BattlePlayer> | undefined;
  pickups: Record<string, Pickup> | undefined;
  powerups: Record<number, Powerup[]> | undefined;
}

const Game: React.FC = () => {
  const params = useParams<{gid?: string; rid?: string}>();

  // Core state
  const [gid, setGid] = useState<string | undefined>(params.gid);
  const [_rid, setRid] = useState<string | undefined>(params.rid);
  const [mobile, setMobile] = useState<boolean>(isMobile());
  const [mode, setMode] = useState<'game' | 'chat'>('game');
  const [chatCollapsed, setChatCollapsed] = useState<boolean>(false);
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [_archived, setArchived] = useState<boolean>(false);

  // Consolidated battle state
  const [battleState, setBattleState] = useState<BattleState>({
    bid: undefined,
    team: undefined,
    opponent: undefined,
    startedAt: undefined,
    winner: undefined,
    players: undefined,
    pickups: undefined,
    powerups: undefined,
  });

  // Refs
  const gameComponentRef = useRef<{
    player?: {state?: {selected?: unknown}};
    handleSelectClue?: (direction: string, number: number) => void;
    focus?: () => void;
  } | null>(null);
  const chatRef = useRef<{focus: () => void} | null>(null);
  const lastRecordedSolveRef = useRef<string | undefined>(undefined);
  const powerupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayNameKeyRef = useRef<string | null>(null);
  const updatingDisplayNameRef = useRef<boolean>(false);
  const gameHookRef = useRef<ReturnType<typeof useGameSetup>['gameHook'] | null>(null);
  const prevWinnerRef = useRef<Winner | undefined>(undefined);
  const autoStartedTimersRef = useRef<Set<string>>(new Set());
  const prevReadyRef = useRef<boolean>(false);

  // Get initial username
  const usernameKey = useMemo(() => `username_${window.location.href}`, []);

  const initialUsername = useMemo(() => {
    return localStorage.getItem(usernameKey) ?? localStorage.getItem('username_default') ?? nameGenerator();
  }, [usernameKey]);

  // Use game setup hook
  const {gameHook, opponentGameHook, game, opponentGame} = useGameSetup({
    gid,
    opponent: battleState.opponent,
    onBattleData: (data: BattleData) => {
      setBattleState((prev) => ({
        ...prev,
        bid: data.bid,
        team: data.team,
      }));
    },
    onArchived: () => {
      setArchived(true);
    },
    initialUsername,
  });

  // Update gameHook ref
  gameHookRef.current = gameHook;

  // Use battle setup hook
  const {battleHook} = useBattleSetup({
    bid: battleState.bid,
    team: battleState.team,
    onGames: (games: string[]) => {
      if (battleState.team !== undefined && games.length > 1 - battleState.team) {
        setBattleState((prev) => ({
          ...prev,
          opponent: games[1 - battleState.team!],
        }));
      }
    },
    onPowerups: (value) => {
      setBattleState((prev) => ({...prev, powerups: value}));
    },
    onStartedAt: (value) => {
      setBattleState((prev) => ({...prev, startedAt: value}));
    },
    onWinner: (value) => {
      setBattleState((prev) => ({...prev, winner: value}));
    },
    onPlayers: (value) => {
      setBattleState((prev) => ({...prev, players: value}));
    },
    onPickups: (value) => {
      setBattleState((prev) => ({...prev, pickups: value}));
    },
    onUsePowerup: (powerupData) => {
      if (gameComponentRef.current?.player) {
        const selected = gameComponentRef.current.player.state?.selected;
        try {
          powerupLib.applyOneTimeEffects(powerupData, {
            gameModel: gameHook as unknown,
            opponentGameModel: opponentGameHook as unknown,
            selected,
          });
          handleChange();
        } catch (err) {
          const powerupErrorMessage = err instanceof Error ? err.message : 'Failed to apply powerup';
          setError(powerupErrorMessage);
          logger.errorWithException('Error applying powerup effects', err, {powerupType: powerupData.type});
        }
      }
    },
  });

  // Use Zustand user hook
  const user = useUser();

  // React Query hook for recording solves
  const recordSolveMutation = useRecordSolve({
    onError: (solveError) => {
      const errorMessage = solveError instanceof Error ? solveError.message : 'Failed to record solve';
      setError(errorMessage);
      logger.errorWithException('Failed to record solve', solveError, {gid});
    },
  });

  const userColorKey = useMemo(() => 'user_color', []);

  // Update params when route changes
  useEffect(() => {
    setGid(params.gid);
    setRid(params.rid);
  }, [params.gid, params.rid]);

  // Handle window resize with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMobile(isMobile());
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Debounced change handler
  const handleChangeRef = useRef<DebouncedFunc<(options?: {isEdit?: boolean}) => Promise<void>>>();
  if (!handleChangeRef.current) {
    handleChangeRef.current = debounce(async (options: {isEdit?: boolean} = {}) => {
      const isEdit = options.isEdit ?? false;
      const currentGame = gameHook.gameState;
      if (!currentGame || !gameHook.ready) {
        return;
      }
      if (isEdit && user.id && gid) {
        await user.joinGame(String(gid), {
          pid: currentGame.pid,
          solved: false,
          v2: true,
        });
      }
      if (currentGame.solved) {
        if (lastRecordedSolveRef.current === gid) return;
        lastRecordedSolveRef.current = gid;
        if (
          currentGame.pid &&
          gid &&
          typeof currentGame.clock?.totalTime === 'number' &&
          currentGame.clock.totalTime >= 0
        ) {
          recordSolveMutation.mutate({
            pid: currentGame.pid,
            gid: String(gid),
            time_to_solve: currentGame.clock.totalTime,
          });
        } else {
          logger.warn('Cannot record solve: invalid data', {
            pid: currentGame.pid,
            gid,
            totalTime: currentGame.clock?.totalTime,
          });
        }
        if (user.id && gid) {
          user.markSolved(String(gid));
        }
        if (battleHook && battleState.team !== undefined) {
          battleHook.setSolved(battleState.team);
        }
      }
    });
  }

  const handleChange = useCallback((options?: {isEdit?: boolean}) => {
    if (handleChangeRef.current) {
      handleChangeRef.current(options || {});
    }
  }, []);

  // Set up powerup spawning interval
  useEffect(() => {
    if (powerupIntervalRef.current) {
      clearInterval(powerupIntervalRef.current);
      powerupIntervalRef.current = null;
    }

    const battlePath = battleState.bid ? `/battle/${battleState.bid}` : '';
    if (battlePath && gameHook.gameState && opponentGameHook.gameState) {
      powerupIntervalRef.current = setInterval(() => {
        if (battleHook) {
          battleHook.spawnPowerups(1, [gameHook.gameState, opponentGameHook.gameState]);
        }
      }, 6 * 1000);
    }

    return () => {
      if (powerupIntervalRef.current) {
        clearInterval(powerupIntervalRef.current);
        powerupIntervalRef.current = null;
      }
    };
  }, [battleState.bid, gameHook.gameState, opponentGameHook.gameState, battleHook]);

  // Handle winner announcement
  useEffect(() => {
    if (prevWinnerRef.current !== battleState.winner && battleState.winner) {
      const {team: winnerTeam, completedAt} = battleState.winner;
      const winningPlayers = Object.values(battleState.players || {}).filter((p) => p.team === winnerTeam);
      const winningPlayersString = winningPlayers.map((p) => p.name).join(', ');

      const victoryMessage = `Team ${Number(winnerTeam) + 1} [${winningPlayersString}] won! `;
      const timeMessage =
        battleState.startedAt !== undefined
          ? `Time taken: ${Number((completedAt - battleState.startedAt) / 1000)} seconds.`
          : '';

      if (gameHook.ready) {
        gameHook.chat('BattleBot', '', victoryMessage + timeMessage);
      }
    }
    prevWinnerRef.current = battleState.winner;
  }, [battleState.winner, battleState.startedAt, battleState.players, gameHook]);

  // Auto-start timer when game becomes ready
  useEffect(() => {
    if (gameHook.ready && game && gid) {
      if (
        !game.solved &&
        game.clock &&
        game.clock.paused &&
        game.clock.totalTime === 0 &&
        (game.clock.lastUpdated === 0 || !game.clock.lastUpdated) &&
        !autoStartedTimersRef.current.has(gid)
      ) {
        autoStartedTimersRef.current.add(gid);
        gameHook.updateClock('start');
        logger.debug('Auto-started game timer', {gid});
      }
    }
  }, [gameHook.ready, game, gid, gameHook]);

  // Simplified display name update logic
  useEffect(() => {
    const key = `${gid}-${user.id}-${initialUsername}`;
    const hook = gameHookRef.current;

    // Skip if already processed
    if (displayNameKeyRef.current === key || !gid || !user.id || !initialUsername || !hook) {
      return;
    }

    // Wait for hook to be ready
    if (!hook.ready || !hook.gameState || !hook.game) {
      return;
    }

    // Check if display name needs updating
    const currentDisplayName = hook.gameState?.['users']?.[user.id]?.displayName;
    if (currentDisplayName === initialUsername) {
      displayNameKeyRef.current = key;
      return;
    }

    // Update display name
    if (!updatingDisplayNameRef.current) {
      updatingDisplayNameRef.current = true;
      hook.updateDisplayName(user.id, initialUsername);
      displayNameKeyRef.current = key;
      setTimeout(() => {
        updatingDisplayNameRef.current = false;
      }, 100);
    }
  }, [gid, user.id, initialUsername]);

  // Also check when game becomes ready
  useEffect(() => {
    const hook = gameHookRef.current;
    const currentReady = hook?.ready ?? false;
    const previousReady = prevReadyRef.current;

    if (!previousReady && currentReady && !updatingDisplayNameRef.current) {
      const key = `${gid}-${user.id}-${initialUsername}`;
      if (
        displayNameKeyRef.current !== key &&
        gid &&
        user.id &&
        initialUsername &&
        hook?.gameState &&
        hook?.game
      ) {
        const currentDisplayName = hook.gameState?.['users']?.[user.id]?.displayName;
        if (currentDisplayName !== initialUsername) {
          updatingDisplayNameRef.current = true;
          hook.updateDisplayName(user.id, initialUsername);
          displayNameKeyRef.current = key;
          setTimeout(() => {
            updatingDisplayNameRef.current = false;
          }, 100);
        } else {
          displayNameKeyRef.current = key;
        }
      }
    }

    prevReadyRef.current = currentReady;
  });

  // Reset display name tracking when game or user changes
  useEffect(() => {
    displayNameKeyRef.current = null;
    updatingDisplayNameRef.current = false;
  }, [gid, user.id]);

  // Computed values
  const showingGame = useMemo(() => !mobile || mode === 'game', [mobile, mode]);
  const showingChat = useMemo(() => !mobile || mode === 'chat', [mobile, mode]);

  const unreads = useMemo(() => {
    if (!game?.chat?.messages || !Array.isArray(game.chat.messages)) return false;
    // Unreads are tracked internally by Chat component
    return true;
  }, [game]);

  const userColor = useMemo(() => {
    if (!game || !user.id) return rand_color();
    const gameUsers = (game as {users?: Record<string, {color?: string}>})['users'];
    const color = gameUsers?.[user.id]?.color || localStorage.getItem(userColorKey) || rand_color();
    localStorage.setItem(userColorKey, color);
    return color;
  }, [game, user.id, userColorKey]);

  const puzzleTitle = useMemo(() => {
    if (!gameHook.ready || !game?.info?.title) {
      return 'Crossword Puzzle';
    }
    return game.info.title;
  }, [gameHook.ready, game]);

  // Event handlers
  const handleToggleChat = useCallback((): void => {
    if (mobile) {
      setMode((prev) => (prev === 'game' ? 'chat' : 'game'));
    } else {
      setChatCollapsed((prev) => !prev);
    }
  }, [mobile]);

  const handleChat = useCallback(
    (username: string, id: string, message: string): void => {
      if (gameHook.ready) {
        gameHook.chat(username, id, message);
      }
    },
    [gameHook]
  );

  const handleUpdateDisplayName = useCallback((id: string, displayName: string): void => {
    const hook = gameHookRef.current;
    if (hook?.ready && hook?.gameState && hook?.game) {
      hook.updateDisplayName(id, displayName);
    }
  }, []);

  const handleUpdateColor = useCallback(
    (id: string, color: string): void => {
      if (gameHook.ready) {
        gameHook.updateColor(id, color);
        localStorage.setItem(userColorKey, color);
      }
    },
    [userColorKey, gameHook]
  );

  // Note: updateSeenChatMessage is handled internally by Chat component

  const handleUnfocusGame = useCallback((): void => {
    if (chatRef.current) {
      chatRef.current.focus();
    }
  }, []);

  const handleUnfocusChat = useCallback((): void => {
    if (gameComponentRef.current) {
      gameComponentRef.current.focus?.();
    }
  }, []);

  const handleSelectClue = useCallback((direction: string, number: number): void => {
    gameComponentRef.current?.handleSelectClue?.(direction, number);
  }, []);

  const handleUsePowerup = useCallback(
    (powerup: Powerup): void => {
      if (battleHook && battleState.team !== undefined) {
        battleHook.usePowerup(powerup.type, battleState.team);
      }
    },
    [battleState.team, battleHook]
  );

  const handleShareLinkDisappeared = useCallback(() => {
    setScrollToBottomTrigger((prev) => prev + 1);
  }, []);

  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  // Render functions
  const renderGame = useCallback((): JSX.Element | undefined => {
    if (!game) {
      return undefined;
    }

    const userId = user.id || '';
    const ownPowerups = battleState.team !== undefined ? battleState.powerups?.[battleState.team] : undefined;
    const opponentPowerups =
      battleState.team !== undefined ? battleState.powerups?.[1 - battleState.team] : undefined;

    return (
      <GameComponent
        ref={gameComponentRef}
        beta={true}
        id={userId}
        gid={gid}
        myColor={userColor}
        gameModel={gameHook as unknown}
        onUnfocus={handleUnfocusGame}
        onChange={handleChange}
        onToggleChat={handleToggleChat}
        mobile={mobile}
        ownPowerups={ownPowerups}
        opponentPowerups={opponentPowerups}
        pickups={battleState.pickups}
        battleModel={battleHook as unknown}
        team={battleState.team}
        unreads={unreads ? 1 : 0}
        scrollToBottomTrigger={scrollToBottomTrigger}
      />
    );
  }, [
    game,
    gid,
    userColor,
    mobile,
    battleState.team,
    battleState.powerups,
    battleState.pickups,
    unreads,
    handleUnfocusGame,
    handleChange,
    handleToggleChat,
    gameHook,
    battleHook,
    scrollToBottomTrigger,
    user.id,
  ]);

  const renderChat = useCallback((): JSX.Element | undefined => {
    if (!gameHook.ready || !game) {
      return undefined;
    }

    const userId = user.id || '';
    const gamePath = gid && isValidGid(gid) ? createSafePath('/game', gid) : undefined;
    const gameUsers =
      (game as {users?: Record<string, {displayName: string; color?: string; teamId?: string}>})['users'] ||
      {};
    const gameChat =
      (
        game as {
          chat?: {
            messages?: Array<{text: string; senderId: string; timestamp: number; isOpponent?: boolean}>;
          };
        }
      )['chat'] || {};
    const gameInfo = (game as {info?: {title: string; description?: string; author?: string; type?: string}})[
      'info'
    ];
    const gameData = {
      info: gameInfo || {title: 'Untitled Puzzle'},
      clock: (game as {clock?: {totalTime: number}})['clock'] || {totalTime: 0},
      pid: (game as {pid?: number})['pid'] || 0,
      solved: (game as {solved?: boolean})['solved'] || false,
      clues: (game as {clues?: {across: string[]; down: string[]}})['clues'] || {across: [], down: []},
      fencingUsers: (game as {fencingUsers?: string[]})['fencingUsers'],
      isFencing: (game as {isFencing?: boolean})['isFencing'],
    };
    return (
      <Chat
        ref={chatRef}
        info={gameInfo}
        path={gamePath || ''}
        data={gameChat}
        game={gameData}
        gid={gid}
        users={gameUsers}
        id={userId}
        myColor={userColor}
        onChat={handleChat}
        onUpdateDisplayName={handleUpdateDisplayName}
        onUpdateColor={handleUpdateColor}
        onUnfocus={handleUnfocusChat}
        onToggleChat={handleToggleChat}
        onSelectClue={handleSelectClue}
        mobile={mobile}
        opponentData={
          opponentGame?.chat as
            | {messages?: Array<{text: string; senderId: string; timestamp: number; isOpponent?: boolean}>}
            | undefined
        }
        bid={battleState.bid}
        initialUsername={initialUsername}
        collapsed={chatCollapsed}
        onShareLinkDisappeared={handleShareLinkDisappeared}
      />
    );
  }, [
    gameHook.ready,
    game,
    gid,
    userColor,
    mobile,
    opponentGame,
    battleState.bid,
    initialUsername,
    handleChat,
    handleUpdateDisplayName,
    handleUpdateColor,
    handleUnfocusChat,
    handleToggleChat,
    handleSelectClue,
    chatCollapsed,
    handleShareLinkDisappeared,
    user.id,
  ]);

  const renderContent = useCallback((): JSX.Element => {
    if (!gameHook.ready || !game) {
      return <GameSkeletonLoader />;
    }

    const teamPowerups =
      battleState.team !== undefined ? battleState.powerups?.[battleState.team] : undefined;
    const gameElement = showingGame ? renderGame() : null;
    const chatElement = showingChat ? renderChat() : null;

    const mobileContent = (
      <>
        <MobilePanel />
        {gameElement}
        {chatElement}
      </>
    );

    const desktopContent = (
      <>
        <Nav v2 />
        <Box
          component="main"
          role="main"
          aria-label="Game area"
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            padding: {xs: '2px', sm: '5px', md: '8px'},
            flexDirection: {xs: 'column', sm: 'row'},
            gap: {xs: 0, sm: 1, md: 2},
            minHeight: 0,
            maxHeight: '100%',
            height: '100%',
          }}
        >
          <Box
            component="section"
            aria-label="Game board"
            sx={{
              flex: chatCollapsed ? 1 : {xs: 1, sm: '0 0 75%'},
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              transition: 'flex 0.3s ease',
              minWidth: 0,
            }}
          >
            <Stack
              direction="column"
              sx={{
                flex: 1,
                minWidth: {xs: '100%', sm: 'auto'},
                maxWidth: {xs: '100%', sm: 'none'},
                width: '100%',
                minHeight: 0,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              {gameElement}
            </Stack>
            {chatCollapsed && !mobile && (
              <IconButton
                onClick={handleToggleChat}
                aria-label="Expand chat panel"
                aria-expanded="false"
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'background.paper',
                  boxShadow: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-50%) translateX(-4px)',
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                  transition: 'transform 0.2s ease',
                  zIndex: 10,
                  display: {xs: 'none', sm: 'flex'},
                }}
                title="Expand chat"
              >
                <MdChevronLeft aria-hidden="true" />
              </IconButton>
            )}
          </Box>
          <Box
            component="aside"
            aria-label="Chat panel"
            aria-expanded={!chatCollapsed}
            sx={{
              flex: chatCollapsed ? '0 0 0' : {xs: '1 1 auto', sm: '0 0 25%'},
              minWidth: chatCollapsed ? 0 : {xs: '100%', sm: '280px', md: '320px'},
              maxWidth: chatCollapsed ? 0 : {xs: '100%', sm: 'none'},
              display: {xs: showingChat ? 'flex' : 'none', sm: 'flex'},
              overflow: 'hidden',
              opacity: {xs: 1, sm: chatCollapsed ? 0 : 1},
              transition: 'flex 0.3s ease, min-width 0.3s ease, max-width 0.3s ease, opacity 0.3s ease',
              pointerEvents: {xs: 'auto', sm: chatCollapsed ? 'none' : 'auto'},
            }}
          >
            {chatElement}
          </Box>
        </Box>
        {teamPowerups && <Powerups powerups={teamPowerups} handleUsePowerup={handleUsePowerup} />}
      </>
    );

    return mobile ? mobileContent : desktopContent;
  }, [
    mobile,
    showingGame,
    showingChat,
    chatCollapsed,
    battleState.team,
    battleState.powerups,
    renderGame,
    renderChat,
    handleUsePowerup,
    handleToggleChat,
    gameHook.ready,
    game,
  ]);

  return (
    <Stack
      className="room"
      direction="column"
      role="application"
      aria-label="Crossword game"
      sx={{
        flex: 1,
        width: '100%',
        height: '100%',
        maxHeight: '100vh',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <Helmet>
        <title>{puzzleTitle}</title>
      </Helmet>
      {renderContent()}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{width: '100%'}}>
          {error}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default Game;
