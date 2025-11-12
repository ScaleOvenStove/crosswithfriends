import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import _ from 'lodash';
import {Helmet} from 'react-helmet';
import {Box, Stack} from '@mui/material';
import Nav from '../components/common/Nav';
import {useParams, useLocation} from 'react-router-dom';

import {useGameStore} from '../store';
import {useGameSetup} from '../hooks/useGameSetup';
import {useBattleSetup} from '../hooks/useBattleSetup';
import {useUser} from '../hooks/useUser';
import type {GameEvent} from '../types/events';
import type {Powerup, Winner, BattlePlayer, Pickup, BattleData, ChatMessage} from '../types/battle';
import GameComponent from '../components/Game';
import MobilePanel from '../components/common/MobilePanel';
import Chat from '../components/Chat';
import Powerups from '../components/common/Powerups';
import {isMobile, rand_color} from '@crosswithfriends/shared/lib/jsUtils';
import {isValidGid, createSafePath} from '../store/firebaseUtils';

import * as powerupLib from '@crosswithfriends/shared/lib/powerups';
import {useRecordSolve} from '../hooks/api/useRecordSolve';
import nameGenerator from '@crosswithfriends/shared/lib/nameGenerator';

const Game: React.FC = () => {
  const params = useParams<{gid?: string; rid?: string}>();
  const location = useLocation();

  const [gid, setGid] = useState<string | undefined>(params.gid);
  const [rid, setRid] = useState<string | undefined>(params.rid);
  const [mobile, setMobile] = useState<boolean>(isMobile());
  const [mode, setMode] = useState<string>('game');
  const [powerups, setPowerups] = useState<Record<number, Powerup[]> | undefined>(undefined);
  const [lastReadChat, setLastReadChat] = useState<number>(0);
  const [bid, setBid] = useState<number | undefined>(undefined);
  const [team, setTeam] = useState<number | undefined>(undefined);
  const [opponent, setOpponent] = useState<string | undefined>(undefined);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const [winner, setWinner] = useState<Winner | undefined>(undefined);
  const [players, setPlayers] = useState<Record<string, BattlePlayer> | undefined>(undefined);
  const [pickups, setPickups] = useState<Record<string, Pickup> | undefined>(undefined);
  const [archived, setArchived] = useState<boolean>(false);
  
  // Get initial username
  const usernameKey = useMemo(() => {
    return `username_${window.location.href}`;
  }, []);

  const initialUsername = useMemo(() => {
    return localStorage.getItem(usernameKey) !== null
      ? localStorage.getItem(usernameKey)!
      : localStorage.getItem('username_default') !== null
        ? localStorage.getItem('username_default')!
        : nameGenerator();
  }, [usernameKey]);

  // Use game setup hook
  const {gameHook, opponentGameHook, game, opponentGame} = useGameSetup({
    gid,
    opponent,
    onBattleData: (data: BattleData) => {
      const {bid: battleId, team: battleTeam} = data;
      setBid(battleId);
      setTeam(battleTeam);
    },
    onArchived: () => {
      setArchived(true);
    },
    initialUsername,
  });

  // Use battle setup hook
  const {battleHook} = useBattleSetup({
    bid,
    team,
    onGames: (games: string[]) => {
      if (team !== undefined && games.length > 1 - team) {
        const opponentGame = games[1 - team];
        setOpponent(opponentGame);
      }
    },
    onPowerups: (value) => {
      setPowerups(value);
    },
    onStartedAt: (value) => {
      setStartedAt(value);
    },
    onWinner: (value) => {
      setWinner(value);
    },
    onPlayers: (value) => {
      setPlayers(value);
    },
    onPickups: (value) => {
      setPickups(value);
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
        } catch (error) {
          console.error('Error applying powerup effects', error);
        }
      }
    },
  });
  const gameComponentRef = useRef<{player?: {state?: {selected?: unknown}}; handleSelectClue?: (direction: string, number: number) => void; focus?: () => void} | null>(null);
  const chatRef = useRef<{focus?: () => void} | null>(null);
  const lastRecordedSolveRef = useRef<string | undefined>(undefined);
  const powerupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayNameSetRef = useRef<string | null>(null); // Track if we've set display name for this user/game
  const updatingDisplayNameRef = useRef<boolean>(false); // Prevent concurrent updates
  
  // Use Zustand user hook instead of EventEmitter User class
  const user = useUser();

  // React Query hook for recording solves
  const recordSolveMutation = useRecordSolve({
    onError: (error) => {
      console.error('Failed to record solve:', error);
    },
  });

  const beta = useMemo(() => true, []);

  const query = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }, [location.search]);

  const userColorKey = useMemo(() => 'user_color', []);


  useEffect(() => {
    setGid(params.gid);
    setRid(params.rid);
  }, [params.gid, params.rid]);

  useEffect(() => {
    const handleResize = () => {
      setMobile(isMobile());
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // User is now provided by useUser hook - no need for ref

  const handleChangeRef = useRef<_.DebouncedFunc<(options?: {isEdit?: boolean}) => Promise<void>>>();
  if (!handleChangeRef.current) {
    handleChangeRef.current = _.debounce(async ({isEdit = false}: {isEdit?: boolean} = {}) => {
      const game = gameHook.gameState;
      if (!game || !gameHook.ready) {
        return;
      }
      if (isEdit && user.id) {
        await user.joinGame(gid!, {
          pid: game.pid,
          solved: false,
          v2: true,
        });
      }
      if (game.solved) {
        if (lastRecordedSolveRef.current === gid) return;
        lastRecordedSolveRef.current = gid;
        // Note: puzzleModel logging would need to be handled differently with Zustand
        // This functionality may need to be refactored if puzzleModel is still needed
        // Validate data before calling recordSolve to prevent 400 errors
        if (game.pid && gid && typeof game.clock?.totalTime === 'number' && game.clock.totalTime >= 0) {
          recordSolveMutation.mutate({
            pid: game.pid,
            gid,
            time_to_solve: game.clock.totalTime,
          });
        } else {
          console.warn('Cannot record solve: invalid data', {
            pid: game.pid,
            gid,
            totalTime: game.clock?.totalTime,
          });
        }
        if (user.id) {
          user.markSolved(gid!);
        }
        if (battleHook && team !== undefined) {
          battleHook.setSolved(team);
        }
      }
    });
  }

  const handleChange = useCallback((options?: {isEdit?: boolean}) => {
    handleChangeRef.current?.(options);
  }, []);

  // Battle is handled by battleHook - no separate initialization needed
  // Battle data comes from gameHook.onBattleData callback
  const battlePath = bid ? `/battle/${bid}` : '';

  // Opponent game is handled by opponentGameHook - no separate initialization needed
  // Set up powerup spawning interval when both games are ready
  useEffect(() => {
    if (powerupIntervalRef.current) {
      clearInterval(powerupIntervalRef.current);
      powerupIntervalRef.current = null;
    }
    
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
  }, [battlePath, gameHook.gameState, opponentGameHook.gameState, battleHook]);

  const prevWinnerRef = useRef<Winner | undefined>(undefined);
  useEffect(() => {
    if (prevWinnerRef.current !== winner && winner) {
      const {team: winnerTeam, completedAt} = winner;
      const winningPlayers = _.filter(_.values(players), {team: winnerTeam});
      const winningPlayersString = _.join(_.map(winningPlayers, 'name'), ', ');

      const victoryMessage = `Team ${Number(winnerTeam) + 1} [${winningPlayersString}] won! `;
      const timeMessage = `Time taken: ${Number((completedAt - startedAt!) / 1000)} seconds.`;

      if (gameHook.ready) {
        gameHook.chat('BattleBot', '', victoryMessage + timeMessage);
      }
    }
    prevWinnerRef.current = winner;
  }, [winner, startedAt, players]);

  const showingGame = useMemo(() => {
    return !mobile || mode === 'game';
  }, [mobile, mode]);

  const showingChat = useMemo(() => {
    return !mobile || mode === 'chat';
  }, [mobile, mode]);

  // Game state comes from useGameSetup hook

  const unreads = useMemo(() => {
    if (!game?.chat?.messages) return false;
    const lastMessage = Math.max(...game.chat.messages.map((m: ChatMessage) => m.timestamp));
    return lastMessage > lastReadChat;
  }, [game, lastReadChat]);

  const userColor = useMemo(() => {
    if (!game || !user.id) return rand_color();
    const color = game.users[user.id]?.color || localStorage.getItem(userColorKey) || rand_color();
    localStorage.setItem(userColorKey, color);
    return color;
  }, [game, user.id, userColorKey]);

  const handleToggleChat = useCallback((): void => {
    setMode((prev) => (prev === 'game' ? 'chat' : 'game'));
  }, []);

  const handleChat = useCallback((username: string, id: string, message: string): void => {
    if (gameHook.ready) {
      gameHook.chat(username, id, message);
    }
  }, [gameHook]);

  const gameHookRef = useRef(gameHook);
  gameHookRef.current = gameHook;

  // Extract primitive values to use in dependencies
  const gameReady = gameHook.ready;
  const gameState = gameHook.gameState;
  const gameInstance = gameHook.game;

  const handleUpdateDisplayName = useCallback((id: string, displayName: string): void => {
    // Only update if game is ready, attached, and has gameState
    // This ensures the game instance exists in the store before we try to add events
    const hook = gameHookRef.current;
    if (hook.ready && hook.gameState && hook.game) {
      hook.updateDisplayName(id, displayName);
    }
  }, []);

  // Reset display name tracking when game or user changes
  useEffect(() => {
    displayNameSetRef.current = null;
    updatingDisplayNameRef.current = false;
  }, [gid, user.id]);

  // Update display name - only runs when gid, user.id, or initialUsername changes
  // Uses refs to check hook state without causing dependency loops
  useEffect(() => {
    // Prevent concurrent updates
    if (updatingDisplayNameRef.current) {
      return;
    }
    
    const key = `${gid}-${user.id}-${initialUsername}`;
    
    // Skip if we've already processed this exact combination
    if (displayNameSetRef.current === key) {
      return;
    }
    
    // Get current values from hook (not from deps to avoid loops)
    const hook = gameHookRef.current;
    if (!gid || !user.id || !initialUsername) {
      return;
    }
    
    // Only proceed if hook is ready
    if (!hook?.ready || !hook?.gameState || !hook?.game) {
      // Not ready yet - don't mark as processed so we can retry when ready
      return;
    }
    
    // Check if display name is already set in game state
    const currentDisplayName = hook.gameState?.users?.[user.id]?.displayName;
    if (currentDisplayName === initialUsername) {
      // Already correct - mark as processed without calling updateDisplayName
      displayNameSetRef.current = key;
      return;
    }
    
    // Set flag to prevent concurrent calls
    updatingDisplayNameRef.current = true;
    
    // Only update if different - this will trigger a store update
    hook.updateDisplayName(user.id, initialUsername);
    
    // Mark as processed immediately to prevent retrying even if store updates
    displayNameSetRef.current = key;
    
    // Reset flag after a short delay to allow store update to complete
    setTimeout(() => {
      updatingDisplayNameRef.current = false;
    }, 100);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, user.id, initialUsername]); // Only depend on these - check hook state inside
  
  // Also check when game becomes ready (using ref to track transition)
  const prevReadyRef = useRef<boolean>(false);
  useEffect(() => {
    const hook = gameHookRef.current;
    const currentReady = hook?.ready ?? false;
    const previousReady = prevReadyRef.current;
    
    // Only act when ready transitions from false to true
    if (!previousReady && currentReady && !updatingDisplayNameRef.current) {
      const key = `${gid}-${user.id}-${initialUsername}`;
      // Only update if we haven't already processed this combo
      if (displayNameSetRef.current !== key && gid && user.id && initialUsername && hook?.gameState && hook?.game) {
        const currentDisplayName = hook.gameState?.users?.[user.id]?.displayName;
        if (currentDisplayName !== initialUsername) {
          updatingDisplayNameRef.current = true;
          hook.updateDisplayName(user.id, initialUsername);
          displayNameSetRef.current = key;
          setTimeout(() => {
            updatingDisplayNameRef.current = false;
          }, 100);
        } else {
          displayNameSetRef.current = key;
        }
      }
    }
    
    prevReadyRef.current = currentReady;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }); // Check on every render but only act on ready transition

  const handleUpdateColor = useCallback(
    (id: string, color: string): void => {
      if (gameHook.ready) {
        gameHook.updateColor(id, color);
        localStorage.setItem(userColorKey, color);
      }
    },
    [userColorKey, gameHook]
  );

  const updateSeenChatMessage = useCallback(
    (message: ChatMessage): void => {
      if (message.timestamp > lastReadChat) {
        setLastReadChat(message.timestamp);
      }
    },
    [lastReadChat]
  );

  const handleUnfocusGame = useCallback((): void => {
    if (chatRef.current) {
      chatRef.current.focus();
    }
  }, []);

  const handleUnfocusChat = useCallback((): void => {
    if (gameComponentRef.current) {
      gameComponentRef.current.focus();
    }
  }, []);

  const handleSelectClue = useCallback((direction: string, number: number): void => {
    if (gameComponentRef.current) {
      gameComponentRef.current.handleSelectClue(direction, number);
    }
  }, []);

  const handleUsePowerup = useCallback(
    (powerup: Powerup): void => {
      if (battleHook && team !== undefined) {
        battleHook.usePowerup(powerup.type, team);
      }
    },
    [team, battleHook]
  );

  const renderGame = useCallback((): JSX.Element | undefined => {
    // Use Zustand gameState instead of HistoryWrapper
    if (!game) {
      return undefined;
    }

    const userId = user.id || '';
    const ownPowerups = _.get(powerups, team);
    const opponentPowerups = _.get(powerups, team !== undefined ? 1 - team : undefined);

    // Pass gameModel even if it's null - the Game component will handle it
    // Still pass historyWrapper for backward compatibility, but GameComponent uses Zustand
    return (
      <GameComponent
        ref={gameComponentRef}
        beta={beta}
        id={userId}
        gid={gid}
        myColor={userColor}
        gameModel={gameHook as unknown} // Pass hook methods as gameModel interface
        onUnfocus={handleUnfocusGame}
        onChange={handleChange}
        onToggleChat={handleToggleChat}
        mobile={mobile}
        ownPowerups={ownPowerups}
        opponentPowerups={opponentPowerups}
        pickups={pickups}
        battleModel={battleHook as unknown} // Pass hook methods as battleModel interface
        team={team}
        unreads={unreads}
      />
    );
  }, [
    beta,
    gid,
    userColor,
    mobile,
    powerups,
    team,
    pickups,
    unreads,
    handleUnfocusGame,
    handleChange,
    handleToggleChat,
    game, // Use game from Zustand
  ]);

  const renderChat = useCallback((): JSX.Element | undefined => {
    if (!gameHook.ready || !game) {
      return undefined;
    }

    const userId = user.id || '';
    // Validate gid before creating path
    const gamePath = gid && isValidGid(gid) ? createSafePath('/game', gid) : undefined;
    return (
      <Chat
        ref={chatRef}
        info={game.info}
        path={gamePath || ''}
        data={game.chat}
        game={game}
        gid={gid}
        users={game.users}
        id={userId}
        myColor={userColor}
        onChat={handleChat}
        onUpdateDisplayName={handleUpdateDisplayName}
        onUpdateColor={handleUpdateColor}
        onUnfocus={handleUnfocusChat}
        onToggleChat={handleToggleChat}
        onSelectClue={handleSelectClue}
        mobile={mobile}
        opponentData={opponentGame?.chat}
        bid={bid}
        updateSeenChatMessage={updateSeenChatMessage}
        initialUsername={initialUsername}
      />
    );
  }, [
    game,
    gid,
    userColor,
    mobile,
    opponentGame,
    bid,
    initialUsername,
    handleChat,
    handleUpdateDisplayName,
    handleUpdateColor,
    handleUnfocusChat,
    handleToggleChat,
    handleSelectClue,
    updateSeenChatMessage,
  ]);

  const puzzleTitle = useMemo((): string => {
    if (!gameHook.ready || !game) {
      return '';
    }
    if (!game.info) return '';
    return game.info.title;
  }, [game]);

  const renderContent = useCallback((): JSX.Element => {
    const teamPowerups = _.get(powerups, team);
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
        <Box sx={{flex: 1, overflow: 'auto', display: 'flex'}}>
          <Stack direction="column" sx={{flexShrink: 0}}>
            {gameElement}
          </Stack>
          <Box sx={{flex: 1}}>{chatElement}</Box>
        </Box>
        {teamPowerups && <Powerups powerups={teamPowerups} handleUsePowerup={handleUsePowerup} />}
      </>
    );

    return mobile ? mobileContent : desktopContent;
  }, [mobile, showingGame, showingChat, powerups, team, renderGame, renderChat, handleUsePowerup]);

  return (
    <Stack
      className="room"
      direction="column"
      sx={{
        flex: 1,
        width: '100%',
        height: '100%',
      }}
    >
      <Helmet>
        <title>{puzzleTitle}</title>
      </Helmet>
      {renderContent()}
    </Stack>
  );
};

export default Game;
