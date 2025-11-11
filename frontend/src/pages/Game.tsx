import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import _ from 'lodash';
import {Helmet} from 'react-helmet';
import {Box, Stack} from '@mui/material';
import Nav from '../components/common/Nav';
import {useParams, useLocation} from 'react-router-dom';

import {useGameStore, getUser, useBattleStore} from '../store';
import HistoryWrapper from '@crosswithfriends/shared/lib/wrappers/HistoryWrapper';
import GameComponent from '../components/Game';
import MobilePanel from '../components/common/MobilePanel';
import Chat from '../components/Chat';
import Powerups from '../components/common/Powerups';
import {isMobile, rand_color} from '@crosswithfriends/shared/lib/jsUtils';

import * as powerupLib from '@crosswithfriends/shared/lib/powerups';
import {recordSolve} from '../api/puzzle';
import User from '../store/user';
import nameGenerator from '@crosswithfriends/shared/lib/nameGenerator';

const Game: React.FC = () => {
  const params = useParams<{gid?: string; rid?: string}>();
  const location = useLocation();

  const [gid, setGid] = useState<string | undefined>(params.gid);
  const [rid, setRid] = useState<string | undefined>(params.rid);
  const [mobile, setMobile] = useState<boolean>(isMobile());
  const [mode, setMode] = useState<string>('game');
  const [powerups, setPowerups] = useState<any>(undefined);
  const [lastReadChat, setLastReadChat] = useState<number>(0);
  const [bid, setBid] = useState<number | undefined>(undefined);
  const [team, setTeam] = useState<number | undefined>(undefined);
  const [opponent, setOpponent] = useState<string | undefined>(undefined);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const [winner, setWinner] = useState<any>(undefined);
  const [players, setPlayers] = useState<any>(undefined);
  const [pickups, setPickups] = useState<any>(undefined);
  const [archived, setArchived] = useState<boolean>(false);

  const gameStore = useGameStore();
  const battleStore = useBattleStore();
  const historyWrapperRef = useRef<HistoryWrapper | null>(null);
  const opponentHistoryWrapperRef = useRef<HistoryWrapper | null>(null);
  const userRef = useRef<User | null>(null);
  const gameComponentRef = useRef<any>(null);
  const chatRef = useRef<any>(null);
  const lastRecordedSolveRef = useRef<string | undefined>(undefined);
  const powerupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Use a ref to track if we need to force an update, avoiding state updates that cause loops
  const needsUpdateRef = useRef<boolean>(false);
  const [updateCounter, setUpdateCounter] = useState(0);

  const forceUpdate = useCallback(() => {
    // Use requestAnimationFrame to batch updates and prevent infinite loops
    if (!needsUpdateRef.current) {
      needsUpdateRef.current = true;
      requestAnimationFrame(() => {
        needsUpdateRef.current = false;
        setUpdateCounter((prev) => prev + 1);
      });
    }
  }, []);

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
    (window as any).gameComponent = {forceUpdate};
  }, [forceUpdate]);

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

  useEffect(() => {
    const user = getUser();
    userRef.current = user;
    const handleAuth = () => {
      forceUpdate();
    };
    user.onAuth(handleAuth);
    return () => {
      user.offAuth(handleAuth);
    };
  }, [forceUpdate]);

  const handleUpdateRef = useRef<_.DebouncedFunc<() => void>>();
  if (!handleUpdateRef.current) {
    // Debounce forceUpdate to prevent infinite loops from rapid updates
    handleUpdateRef.current = _.debounce(
      () => {
        forceUpdate();
      },
      16, // ~60fps - debounce to prevent excessive updates
      {
        leading: true,
        trailing: true,
      }
    );
  }

  const handleChangeRef = useRef<_.DebouncedFunc<(options?: {isEdit?: boolean}) => Promise<void>>>();
  if (!handleChangeRef.current) {
    handleChangeRef.current = _.debounce(async ({isEdit = false}: {isEdit?: boolean} = {}) => {
      if (!historyWrapperRef.current?.ready) {
        return;
      }

      const game = historyWrapperRef.current.getSnapshot();
      if (isEdit && userRef.current) {
        await userRef.current.joinGame(gid!, {
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
          try {
            await recordSolve(game.pid, gid, game.clock.totalTime);
          } catch (error) {
            console.error('Failed to record solve:', error);
            // Don't block UI if recording fails
          }
        } else {
          console.warn('Cannot record solve: invalid data', {
            pid: game.pid,
            gid,
            totalTime: game.clock?.totalTime,
          });
        }
        if (userRef.current) {
          userRef.current.markSolved(gid!);
        }
        if (bid !== undefined && team !== undefined) {
          const battlePath = `/battle/${bid}`;
          battleStore.setSolved(battlePath, team);
        }
      }
    });
  }

  const handleChange = useCallback((options?: {isEdit?: boolean}) => {
    handleChangeRef.current?.(options);
  }, []);

  const initializeOpponentGame = useCallback(
    (opponentGameId: string): void => {
      if (!opponentGameId) return;

      const opponentPath = `/game/${opponentGameId}`;
      // Don't call detach during initialization - it causes state updates that trigger re-renders
      // Instead, just clean up the old history wrapper if it exists
      if (opponentHistoryWrapperRef.current) {
        const oldUnsubscribes = (opponentHistoryWrapperRef.current as any).unsubscribes;
        if (oldUnsubscribes) {
          Object.values(oldUnsubscribes).forEach((unsub: any) => {
            if (typeof unsub === 'function') unsub();
          });
        }
      }

      const opponentHistoryWrapper = new HistoryWrapper();
      opponentHistoryWrapperRef.current = opponentHistoryWrapper;

      const unsubscribeOpponentCreate = gameStore.subscribe(opponentPath, 'createEvent', (event: any) => {
        if (opponentHistoryWrapperRef.current) {
          opponentHistoryWrapperRef.current.setCreateEvent(event);
          handleUpdateRef.current?.();
        }
      });
      const unsubscribeOpponentEvent = gameStore.subscribe(opponentPath, 'event', (event: any) => {
        if (opponentHistoryWrapperRef.current) {
          opponentHistoryWrapperRef.current.addEvent(event);
          // Opponent events need UI update
          handleUpdateRef.current?.();
        }
      });

      // For now, every client spawns pickups. That makes sense maybe from a balance perpsective.
      // It's just easier to write. Also for now you can have multiple in the same tile oops.
      // TODO: fix these.
      if (powerupIntervalRef.current) {
        clearInterval(powerupIntervalRef.current);
      }
      powerupIntervalRef.current = setInterval(() => {
        const battlePath = bid !== undefined ? `/battle/${bid}` : undefined;
        if (battlePath && historyWrapperRef.current && opponentHistoryWrapperRef.current) {
          const game = historyWrapperRef.current.getSnapshot();
          const opponentGame = opponentHistoryWrapperRef.current.getSnapshot();
          battleStore.spawnPowerups(battlePath, 1, [game, opponentGame]);
        }
      }, 6 * 1000);

      gameStore.attach(opponentPath);

      // Store unsubscribe functions for cleanup
      (opponentHistoryWrapperRef.current as any).unsubscribes = {
        create: unsubscribeOpponentCreate,
        event: unsubscribeOpponentEvent,
      };
    },
    [handleChange, gameStore, battleStore, bid]
  );

  const initializeBattle = useCallback(
    (battleData: any): void => {
      if (!battleData) {
        return;
      }

      const {bid: battleId, team: battleTeam} = battleData;
      setBid(battleId);
      setTeam(battleTeam);

      const battlePath = `/battle/${battleId}`;
      battleStore.detach(battlePath);

      let gamesUnsubscribed = false;
      const unsubscribeGames = battleStore.subscribe(battlePath, 'games', (games: string[]) => {
        if (!gamesUnsubscribed) {
          gamesUnsubscribed = true;
          unsubscribeGames();
          const opponentGame = games[1 - battleTeam!];
          setOpponent(opponentGame);
          initializeOpponentGame(opponentGame);
        }
      });

      const unsubscribeUsePowerup = battleStore.subscribe(battlePath, 'usePowerup', (powerup: any) => {
        const gamePath = gid ? `/game/${gid}` : undefined;
        const opponentPath = opponent ? `/game/${opponent}` : undefined;
        if (gameComponentRef.current?.player) {
          const selected = gameComponentRef.current.player.state?.selected;
          powerupLib.applyOneTimeEffects(powerup, {
            gameModel: gamePath ? gameStore.getGame(gamePath) : undefined,
            opponentGameModel: opponentPath ? gameStore.getGame(opponentPath) : undefined,
            selected,
          });
          handleChange();
        }
      });

      const unsubscribePowerups = battleStore.subscribe(battlePath, 'powerups', (value: any) => {
        setPowerups(value);
      });
      const unsubscribeStartedAt = battleStore.subscribe(battlePath, 'startedAt', (value: any) => {
        setStartedAt(value);
      });
      const unsubscribeWinner = battleStore.subscribe(battlePath, 'winner', (value: any) => {
        setWinner(value);
      });
      const unsubscribePlayers = battleStore.subscribe(battlePath, 'players', (value: any) => {
        setPlayers(value);
      });
      const unsubscribePickups = battleStore.subscribe(battlePath, 'pickups', (value: any) => {
        setPickups(value);
      });
      battleStore.attach(battlePath);

      // Store unsubscribe functions for cleanup
      (battleStore as any).battleUnsubscribes = {
        games: unsubscribeGames,
        usePowerup: unsubscribeUsePowerup,
        powerups: unsubscribePowerups,
        startedAt: unsubscribeStartedAt,
        winner: unsubscribeWinner,
        players: unsubscribePlayers,
        pickups: unsubscribePickups,
      };
    },
    [initializeOpponentGame, handleChange, battleStore, gid, opponent]
  );

  const initializeGame = useCallback((): void => {
    if (!gid) return;

    const gamePath = `/game/${gid}`;
    // Don't call detach during initialization - it causes state updates that trigger re-renders
    // Instead, just clean up the old history wrapper if it exists
    if (historyWrapperRef.current) {
      // Clean up old subscriptions if any
      const oldUnsubscribes = (historyWrapperRef.current as any).unsubscribes;
      if (oldUnsubscribes) {
        Object.values(oldUnsubscribes).forEach((unsub: any) => {
          if (typeof unsub === 'function') unsub();
        });
      }
    }

    const historyWrapper = new HistoryWrapper();
    historyWrapperRef.current = historyWrapper;

    let battleDataUnsubscribed = false;
    const unsubscribeBattleData = gameStore.subscribe(gamePath, 'battleData', (battleData: any) => {
      if (!battleDataUnsubscribed && battleData) {
        battleDataUnsubscribed = true;
        unsubscribeBattleData();
        initializeBattle(battleData);
      }
    });

    console.log('listening ws');
    const unsubscribeWsCreate = gameStore.subscribe(gamePath, 'wsCreateEvent', (event: any) => {
      console.log('create event', event);
      if (historyWrapperRef.current) {
        historyWrapperRef.current.setCreateEvent(event);
        handleUpdateRef.current?.();
      }
    });
    const unsubscribeWsEvent = gameStore.subscribe(gamePath, 'wsEvent', (event: any) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.addEvent(event);
        handleChange();
        // Only force update if needed - handleChange already triggers updates
        handleUpdateRef.current?.();
      }
    });
    const unsubscribeWsOptimistic = gameStore.subscribe(gamePath, 'wsOptimisticEvent', (event: any) => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.addOptimisticEvent(event);
        // Optimistic events need immediate UI update
        handleUpdateRef.current?.();
      }
    });
    const unsubscribeReconnect = gameStore.subscribe(gamePath, 'reconnect', () => {
      if (historyWrapperRef.current) {
        historyWrapperRef.current.clearOptimisticEvents();
        // Reconnect needs UI update
        handleUpdateRef.current?.();
      }
    });

    const unsubscribeArchived = gameStore.subscribe(gamePath, 'archived', () => {
      setArchived(true);
    });
    gameStore.attach(gamePath);

    // Store unsubscribe functions for cleanup
    (historyWrapperRef.current as any).unsubscribes = {
      battleData: unsubscribeBattleData,
      wsCreate: unsubscribeWsCreate,
      wsEvent: unsubscribeWsEvent,
      wsOptimistic: unsubscribeWsOptimistic,
      reconnect: unsubscribeReconnect,
      archived: unsubscribeArchived,
    };
  }, [gid, initializeBattle, handleChange, gameStore]);

  useEffect(() => {
    if (gid) {
      initializeGame();
      if (userRef.current) {
        handleUpdateDisplayName(userRef.current.id, initialUsername);
      }
    }
  }, [gid, initializeGame, initialUsername]);

  // Cleanup effect - runs when gid, opponent, or bid changes, or on unmount
  useEffect(() => {
    // Capture current values for cleanup
    const currentGid = gid;
    const currentOpponent = opponent;
    const currentBid = bid;

    return () => {
      // Use setTimeout to defer cleanup and avoid state updates during unmount
      // This prevents infinite loops from setState during cleanup
      setTimeout(() => {
        if (currentGid) {
          const gamePath = `/game/${currentGid}`;
          gameStore.detach(gamePath);
        }
        if (currentOpponent) {
          const opponentPath = `/game/${currentOpponent}`;
          gameStore.detach(opponentPath);
        }
        if (currentBid !== undefined) {
          const battlePath = `/battle/${currentBid}`;
          battleStore.detach(battlePath);
        }
        if (powerupIntervalRef.current) {
          clearInterval(powerupIntervalRef.current);
          powerupIntervalRef.current = null;
        }
      }, 0);
    };
    // Only depend on gid, opponent, bid - not the stores (they're stable references)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, opponent, bid]);

  const prevWinnerRef = useRef<any>(undefined);
  useEffect(() => {
    if (prevWinnerRef.current !== winner && winner) {
      const {team: winnerTeam, completedAt} = winner;
      const winningPlayers = _.filter(_.values(players), {team: winnerTeam});
      const winningPlayersString = _.join(_.map(winningPlayers, 'name'), ', ');

      const victoryMessage = `Team ${Number(winnerTeam) + 1} [${winningPlayersString}] won! `;
      const timeMessage = `Time taken: ${Number((completedAt - startedAt!) / 1000)} seconds.`;

      if (gid) {
        const gamePath = `/game/${gid}`;
        gameStore.chat(gamePath, 'BattleBot', '', victoryMessage + timeMessage);
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

  // Cache snapshots to avoid unnecessary recalculations
  const gameSnapshotRef = useRef<any>(null);
  const opponentGameSnapshotRef = useRef<any>(undefined);
  const gameHistoryLengthRef = useRef<number>(0);
  const opponentGameHistoryLengthRef = useRef<number>(0);
  const lastUpdateTriggerRef = useRef<number>(0);

  // Get game snapshot - only recalculate when history actually changes
  const game = useMemo(() => {
    if (!historyWrapperRef.current) {
      gameSnapshotRef.current = null;
      return null;
    }

    const currentLength = historyWrapperRef.current.history?.length ?? 0;
    const needsRecalc =
      currentLength !== gameHistoryLengthRef.current || lastUpdateTriggerRef.current !== updateCounter;

    if (needsRecalc) {
      gameHistoryLengthRef.current = currentLength;
      lastUpdateTriggerRef.current = updateCounter;
      gameSnapshotRef.current = historyWrapperRef.current.getSnapshot();
    }

    return gameSnapshotRef.current;
  }, [updateCounter]);

  const opponentGame = useMemo(() => {
    if (!opponentHistoryWrapperRef.current?.ready || !opponentHistoryWrapperRef.current) {
      opponentGameSnapshotRef.current = undefined;
      return undefined;
    }

    const currentLength = opponentHistoryWrapperRef.current.history?.length ?? 0;
    const needsRecalc =
      currentLength !== opponentGameHistoryLengthRef.current ||
      lastUpdateTriggerRef.current !== updateCounter;

    if (needsRecalc) {
      opponentGameHistoryLengthRef.current = currentLength;
      opponentGameSnapshotRef.current = opponentHistoryWrapperRef.current.getSnapshot();
    }

    return opponentGameSnapshotRef.current;
  }, [updateCounter]);

  const unreads = useMemo(() => {
    if (!game?.chat?.messages) return false;
    const lastMessage = Math.max(...game.chat.messages.map((m: any) => m.timestamp));
    return lastMessage > lastReadChat;
  }, [game, lastReadChat]);

  const userColor = useMemo(() => {
    if (!game || !userRef.current) return rand_color();
    const color = game.users[userRef.current.id]?.color || localStorage.getItem(userColorKey) || rand_color();
    localStorage.setItem(userColorKey, color);
    return color;
  }, [game, userColorKey]);

  const handleToggleChat = useCallback((): void => {
    setMode((prev) => (prev === 'game' ? 'chat' : 'game'));
  }, []);

  const handleChat = useCallback(
    (username: string, id: string, message: string): void => {
      if (gid) {
        const gamePath = `/game/${gid}`;
        gameStore.chat(gamePath, username, id, message);
      }
    },
    [gid, gameStore]
  );

  const handleUpdateDisplayName = useCallback(
    (id: string, displayName: string): void => {
      if (gid) {
        const gamePath = `/game/${gid}`;
        gameStore.updateDisplayName(gamePath, id, displayName);
      }
    },
    [gid, gameStore]
  );

  const handleUpdateColor = useCallback(
    (id: string, color: string): void => {
      if (gid) {
        const gamePath = `/game/${gid}`;
        gameStore.updateColor(gamePath, id, color);
        localStorage.setItem(userColorKey, color);
      }
    },
    [userColorKey, gid, gameStore]
  );

  const updateSeenChatMessage = useCallback(
    (message: any): void => {
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
    (powerup: any): void => {
      if (bid !== undefined && team !== undefined) {
        const battlePath = `/battle/${bid}`;
        battleStore.usePowerup(battlePath, powerup.type, team);
      }
    },
    [team, bid, battleStore]
  );

  const renderGame = useCallback((): JSX.Element | undefined => {
    if (!historyWrapperRef.current?.ready) {
      return undefined;
    }

    const userId = userRef.current?.id || '';
    const ownPowerups = _.get(powerups, team);
    const opponentPowerups = _.get(powerups, team !== undefined ? 1 - team : undefined);
    const gamePath = gid ? `/game/${gid}` : undefined;
    const gameInstance = gamePath ? gameStore.getGame(gamePath) : undefined;
    return (
      <GameComponent
        ref={gameComponentRef}
        beta={beta}
        id={userId}
        gid={gid}
        myColor={userColor}
        historyWrapper={historyWrapperRef.current}
        gameModel={gameInstance as any}
        onUnfocus={handleUnfocusGame}
        onChange={handleChange}
        onToggleChat={handleToggleChat}
        mobile={mobile}
        opponentHistoryWrapper={opponentHistoryWrapperRef.current?.ready && opponentHistoryWrapperRef.current}
        ownPowerups={ownPowerups}
        opponentPowerups={opponentPowerups}
        pickups={pickups}
        battleModel={bid !== undefined ? (battleStore.getBattle(`/battle/${bid}`) as any) : undefined}
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
    gameStore,
    battleStore,
    bid,
  ]);

  const renderChat = useCallback((): JSX.Element | undefined => {
    if (!historyWrapperRef.current?.ready || !game) {
      return undefined;
    }

    const userId = userRef.current?.id || '';
    const gamePath = gid ? `/game/${gid}` : undefined;
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
    if (!historyWrapperRef.current?.ready || !game) {
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
