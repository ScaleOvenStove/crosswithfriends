import _ from 'lodash';
import * as uuid from 'uuid';
import React, {useState, useEffect} from 'react';
import {useUpdateEffect} from 'react-use';
import {Helmet} from 'react-helmet';
import {Box, Stack} from '@mui/material';
import {useSocket} from '../../sockets/useSocket';
import {emitAsync} from '../../sockets/emitAsync';
import Player from '../Player';
import {transformGameToPlayerProps} from './transformGameToPlayerProps';
import {usePlayerActions} from './usePlayerActions';
import {useToolbarActions} from './useToolbarActions';
import type {GameEvent} from '@crosswithfriends/shared/fencingGameEvents/types/GameEvent';
import {useUser} from '../../hooks/useUser';
import {FencingScoreboard} from './FencingScoreboard';
import {TEAM_IDS} from '@crosswithfriends/shared/fencingGameEvents/constants';
import {FencingToolbar} from './FencingToolbar';
import nameGenerator from '@crosswithfriends/shared/lib/nameGenerator';
import {useGameEvents} from './useGameEvents';
import type {GameEventsHook} from './useGameEvents';
import {getStartingCursorPosition} from '@crosswithfriends/shared/fencingGameEvents/eventDefs/create';
import Nav from '../common/Nav';
import Chat from '../Chat';
import {FencingCountdown} from './FencingCountdown';
import Confetti from '../Game/Confetti';

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
  const gameEventHandler = (event: any) => {
    if (!connected) return;
    eventsHook.addEvent(event);
  };

  async function joinAndSync() {
    if (!socket) return;
    await emitAsync(socket, 'join_game', gid);
    socket.on('game_event', gameEventHandler);
    const allEvents: GameEvent[] = (await emitAsync(socket, 'sync_all_game_events', gid)) as any;
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
  async function sendEvent(event: GameEvent) {
    (event as any).timestamp = {
      '.sv': 'timestamp',
    };
    (event as any).id = uuid.v4();
    eventsHook.addOptimisticEvent(event);
    if (socket) {
      emitAsync(socket, 'game_event', {gid, event});
    } else {
      console.warn('Cannot send event; not connected to server');
    }
  }

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
      setHasRevealedAll(true);
    }
  }, [isGameComplete, hasRevealedAll, gameState.loaded, gameState.started]);
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
        const nTeamId = _.minBy(
          TEAM_IDS,
          (t) => _.filter(_.values(gameState.users), (user) => user.teamId === t).length
        )!;
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
            cell: getStartingCursorPosition(gameState.game!, nTeamId),
          },
        });
      }
    }
  }, [isInitialized]);

  const classes = useStyles();

  const toolbarActions = useToolbarActions(sendEvent, gameState, id);
  const playerActions = usePlayerActions(sendEvent, id);

  const changeName = (newName: string): void => {
    if (newName.trim().length === 0) {
      newName = nameGenerator();
    }
    sendEvent({
      type: 'updateDisplayName',
      params: {
        id,
        displayName: newName,
      },
    });
  };
  const changeTeamName = (newName: string): void => {
    if (!teamId) return;
    if (newName.trim().length === 0) {
      newName = nameGenerator();
    }
    sendEvent({
      type: 'updateTeamName',
      params: {
        teamId,
        teamName: newName,
      },
    });
  };
  const joinTeam = (teamId: number) => {
    sendEvent({
      type: 'updateTeamId',
      params: {
        id,
        teamId,
      },
    });
  };
  const spectate = () => {
    sendEvent({
      type: 'updateTeamId',
      params: {
        id,
        teamId: teamId ? 0 : 1,
      },
    });
  };
  const handleChat = (username: string, id: string, message: string) => {
    sendEvent({
      type: 'sendChatMessage',
      params: {
        id,
        message,
      },
    });
    sendEvent({
      type: 'chat' as any,
      params: {
        id,
        text: message,
      },
    });
  };
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
                  <Player
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...transformGameToPlayerProps(
                      gameState.game!,
                      _.values(gameState.users),
                      playerActions,
                      id,
                      teamId
                    )}
                  />
                </>
              )}
            </FencingCountdown>
          </Box>
        </Box>
        <Stack direction="column" sx={{flexBasis: 500}}>
          {!gameState.loaded && <div>Loading your game...</div>}
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
              onUpdateDisplayName={(_id: string, name: string) => changeName(name)}
            />
          )}
        </Stack>
      </Box>
      {isGameComplete && <Confetti />}
    </Stack>
  );
};
