import {TEAM_IDS} from '@crosswithfriends/shared/fencingGameEvents/constants';
import {getStartingCursorPosition} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/create';
import type {GameEvent} from '@crosswithfriends/shared/fencingGameEvents/types/GameEvent';
import nameGenerator from '@crosswithfriends/shared/lib/nameGenerator';
import {Box, Stack} from '@mui/material';
import React, {useState, useEffect, useCallback} from 'react';
import {Helmet} from 'react-helmet';
import {useUpdateEffect} from 'react-use';
import type {Socket as SocketIOClient} from 'socket.io-client';

const filter = <T,>(arr: T[], fn: (item: T) => boolean): T[] => arr.filter(fn);

const minBy = <T,>(arr: T[], fn: (item: T) => number): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr.reduce((min, item) => (fn(item) < fn(min) ? item : min));
};

import {useUser} from '../../hooks/useUser';
import {emitAsync} from '../../sockets/emitAsync';
import {useSocket} from '../../sockets/useSocket';
import {logger} from '../../utils/logger';
import Chat from '../Chat';
import LoadingSpinner from '../common/LoadingSpinner';
import Nav from '../common/Nav';
import Confetti from '../Game/Confetti';
import Player from '../Player';

import {FencingCountdown} from './FencingCountdown';
import {FencingScoreboard} from './FencingScoreboard';
import {FencingToolbar} from './FencingToolbar';
import {transformGameToPlayerProps} from './transformGameToPlayerProps';
import {useGameEvents} from './useGameEvents';
import type {GameEventsHook} from './useGameEvents';
import {usePlayerActions} from './usePlayerActions';
import {useToolbarActions} from './useToolbarActions';

/**
 * Subscribes to Socket.io game events for a specific game.
 * Joins the game room, sets up event listeners, and syncs all existing events.
 *
 * @param socket - The Socket.io client instance (may be undefined if not connected)
 * @param gid - Game ID to subscribe to
 * @param eventsHook - Hook for managing game events state
 * @returns Object with syncPromise and unsubscribe function
 */
function subscribeToGameEvents(
  socket: SocketIOClient.Socket | undefined,
  gid: string,
  eventsHook: GameEventsHook
) {
  let connected = false;
  const gameEventHandler = (event: GameEvent) => {
    if (!connected) return;
    eventsHook.addEvent(event);
  };

  async function joinAndSync() {
    if (!socket) return;
    await emitAsync(socket, 'join_game', gid);
    socket.on('game_event', gameEventHandler);
    const allEvents = (await emitAsync(socket, 'sync_all_game_events', gid)) as GameEvent[];
    eventsHook.setEvents(allEvents);

    connected = true;
  }
  function unsubscribe() {
    if (!socket) return;
    // Remove the event listener to prevent memory leaks
    socket.off('game_event', gameEventHandler);
    emitAsync(socket, 'leave_game', gid);
  }
  const syncPromise = joinAndSync();

  return {syncPromise, unsubscribe};
}

/**
 * Competitive crossword game component that renders a Player component with real-time multiplayer support.
 * Manages game state synchronization via Socket.io and implements fencing-specific game logic.
 *
 * @param props - Component props
 * @param props.gid - Game ID for the fencing match
 *
 * @example
 * ```tsx
 * <Fencing gid="game-123" />
 * ```
 */
export const Fencing: React.FC<{gid: string}> = (props) => {
  const {gid} = props;
  const socket = useSocket();

  const eventsHook = useGameEvents();
  const sendEvent = useCallback(
    async (event: GameEvent) => {
      eventsHook.addOptimisticEvent(event);
      if (socket) {
        emitAsync(socket, 'game_event', {gid, event});
      } else {
        logger.warn('Cannot send event; not connected to server', {gid, eventType: event.type});
      }
    },
    [eventsHook, socket, gid]
  );

  const [isInitialized, setIsInitialized] = useState(false);
  useUpdateEffect(() => {
    eventsHook.setEvents([]);
    const {syncPromise, unsubscribe} = subscribeToGameEvents(socket, gid, eventsHook);
    syncPromise.then(() => {
      setIsInitialized(true);
    });
    return unsubscribe;
  }, [gid, socket]);
  const gameState = eventsHook.gameState;
  const user = useUser();

  const id = user.id;
  const teamId = id ? gameState.users[id]?.teamId : undefined;
  const isGameComplete =
    gameState.game?.grid.every((row) => row.every((cell) => cell.good || cell.black)) ?? false;
  const [hasRevealedAll, setHasRevealedAll] = useState(false);

  // for revealing all cells on game completion
  // separate from useUpdateEffect bc we want it to work when you join an already-completed game
  useEffect(() => {
    if (isGameComplete && !hasRevealedAll && gameState.loaded && gameState.started) {
      sendEvent({
        type: 'revealAllClues',
        params: {},
      });
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => {
        setHasRevealedAll(true);
      }, 0);
    }
  }, [isGameComplete, hasRevealedAll, gameState.loaded, gameState.started, sendEvent]);
  useUpdateEffect(() => {
    if (isInitialized) {
      if (!gameState) {
        return; // shouldn't happen
      }
      if (!gameState.users[id]?.displayName) {
        sendEvent({
          type: 'updateDisplayName',
          params: {
            id,
            displayName: nameGenerator(),
          },
        });
      }
      if (!teamId) {
        if (!gameState.game) {
          return; // game not loaded yet
        }
        const nTeamId =
          minBy(TEAM_IDS, (t) => filter(Object.values(gameState.users), (u) => u.teamId === t).length) ??
          (TEAM_IDS[0] as number);
        sendEvent({
          type: 'updateTeamId',
          params: {
            id,
            teamId: nTeamId,
          },
        });
        sendEvent({
          type: 'updateCursor',
          params: {
            id,
            cell: getStartingCursorPosition(gameState.game, nTeamId),
          },
        });
      }
    }
  }, [isInitialized]);

  const toolbarActions = useToolbarActions(sendEvent, gameState, id);
  const playerActions = usePlayerActions(sendEvent, id);

  const changeName = useCallback(
    (newName: string): void => {
      let finalName = newName;
      if (finalName.trim().length === 0) {
        finalName = nameGenerator();
      }
      sendEvent({
        type: 'updateDisplayName',
        params: {
          id,
          displayName: finalName,
        },
      });
    },
    [sendEvent, id]
  );

  const changeTeamName = useCallback(
    (newName: string): void => {
      if (!teamId) return;
      let finalName = newName;
      if (finalName.trim().length === 0) {
        finalName = nameGenerator();
      }
      sendEvent({
        type: 'updateTeamName',
        params: {
          teamId,
          teamName: finalName,
        },
      });
    },
    [sendEvent, teamId]
  );

  const joinTeam = useCallback(
    (newTeamId: number) => {
      sendEvent({
        type: 'updateTeamId',
        params: {
          id,
          teamId: newTeamId,
        },
      });
    },
    [sendEvent, id]
  );

  const spectate = useCallback(() => {
    sendEvent({
      type: 'updateTeamId',
      params: {
        id,
        teamId: teamId ? 0 : 1,
      },
    });
  }, [sendEvent, id, teamId]);

  const handleChat = useCallback(
    (username: string, userId: string, message: string) => {
      sendEvent({
        type: 'sendChatMessage',
        params: {
          id,
          message,
        },
      });
      // Note: 'chat' event type is deprecated, using 'sendChatMessage' instead
      // This legacy event is kept for backward compatibility
      sendEvent({
        type: 'sendChatMessage',
        params: {
          id,
          message,
        },
      });
    },
    [sendEvent, id]
  );

  const handleUpdateDisplayName = useCallback(
    (_id: string, name: string) => {
      changeName(name);
    },
    [changeName]
  );

  const fencingScoreboard = (
    <FencingScoreboard
      gameState={gameState}
      currentUserId={id}
      changeName={changeName}
      changeTeamName={changeTeamName}
      joinTeam={joinTeam}
      spectate={spectate}
      isGameComplete={isGameComplete}
    />
  );
  return (
    <Stack direction="column" sx={{flex: 1}}>
      <Nav hidden={false} v2 canLogin={false} divRef={null} linkStyle={null} mobile={null} />
      <Box sx={{flex: 1, overflow: 'auto', display: 'flex'}}>
        <Box sx={{flex: 1, display: 'flex', padding: 3, flexDirection: 'column'}}>
          <Helmet title={`Fencing ${gid}`} />
          <Box sx={{flex: 1}}>
            <FencingCountdown playerActions={playerActions} gameState={gameState} gameEventsHook={eventsHook}>
              {gameState.loaded && gameState.started && (
                <>
                  {' '}
                  <FencingToolbar toolbarActions={toolbarActions} />
                  {gameState.game && (
                    <Player
                      // eslint-disable-next-line react/jsx-props-no-spreading
                      {...transformGameToPlayerProps(
                        gameState.game,
                        Object.values(gameState.users),
                        playerActions,
                        id,
                        teamId
                      )}
                    />
                  )}
                </>
              )}
            </FencingCountdown>
          </Box>
        </Box>
        <Stack direction="column" sx={{flexBasis: 500}}>
          {!gameState.loaded && <LoadingSpinner message="Loading your game..." />}
          {gameState.game && (
            <Chat
              isFencing
              subheader={
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    marginBottom: 1.5,
                    '& *': {borderCollapse: 'collapse'},
                  }}
                >
                  {fencingScoreboard}
                </Box>
              }
              info={gameState.game.info}
              teams={gameState.teams}
              path={`/fencing/${gid}`}
              data={gameState.chat}
              game={gameState.game}
              gid={gid}
              users={gameState.users}
              id={id}
              myColor={null}
              onChat={handleChat}
              mobile={false}
              updateSeenChatMessage={null}
              onUpdateDisplayName={handleUpdateDisplayName}
            />
          )}
        </Stack>
      </Box>
      {isGameComplete && <Confetti />}
    </Stack>
  );
};
