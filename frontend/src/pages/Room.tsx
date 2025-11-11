import React, {Dispatch, SetStateAction, useEffect, useMemo, useState} from 'react';
import {useUpdateEffect} from 'react-use';
import _ from 'lodash';
import {Helmet} from 'react-helmet';
import {useParams} from 'react-router-dom';

import {Box} from '@mui/material';
import {RoomEvent, SetGameRoomEvent, UserPingRoomEvent} from '@crosswithfriends/shared/roomEvents';
import {useSocket} from '../sockets/useSocket';
import {initialRoomState, roomReducer} from '@crosswithfriends/shared/lib/reducers/room';
import {emitAsync} from '../sockets/emitAsync';
import {getUser} from '../store';

const ACTIVE_SECONDS_TIMEOUT = 60;

function subscribeToRoomEvents(
  socket: SocketIOClient.Socket | undefined,
  rid: string,
  setEvents: Dispatch<SetStateAction<RoomEvent[]>>
) {
  let connected = false;
  async function joinAndSync() {
    if (!socket) return;
    await emitAsync(socket, 'join_room', rid);
    socket.on('room_event', (event: any) => {
      if (!connected) return;
      setEvents((events) => [...events, event]);
    });
    const allEvents: RoomEvent[] = (await emitAsync(socket, 'sync_all_room_events', rid)) as any;
    setEvents(allEvents);
    connected = true;
  }
  function unsubscribe() {
    if (!socket) return;
    console.log('unsubscribing from room events...');
    emitAsync(socket, 'leave_room', rid);
  }
  const syncPromise = joinAndSync();

  return {syncPromise, unsubscribe};
}

function useRoomState(events: RoomEvent[]) {
  // TODO history manager for perf optimization
  return useMemo(() => events.reduce(roomReducer, initialRoomState), [events]);
}

const useTimer = (interval = 1000): number => {
  const [time, setTime] = useState(Date.now());
  useEffect(() => {
    const itvl = setInterval(() => {
      setTime(Date.now());
    }, interval);
    return () => {
      clearInterval(itvl);
    };
  }, [interval]);
  return time;
};

const Room: React.FC = () => {
  const params = useParams<{rid: string}>();
  const rid = params.rid || '';
  const socket = useSocket();
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const roomState = useRoomState(events);

  async function sendUserPing() {
    if (socket) {
      const uid = getUser().id;
      const event = UserPingRoomEvent(uid);
      emitAsync(socket, 'room_event', {rid, event});
    }
  }
  async function setGame(gid: string) {
    if (socket) {
      const uid = getUser().id;
      const event = SetGameRoomEvent(gid, uid);
      emitAsync(socket, 'room_event', {rid, event});
    }
  }
  useUpdateEffect(() => {
    setEvents([]);
    const {syncPromise, unsubscribe} = subscribeToRoomEvents(socket, rid, setEvents);
    syncPromise.then(sendUserPing);
    return unsubscribe;
  }, [rid, socket]);
  useUpdateEffect(() => {
    const renewActivity = _.throttle(sendUserPing, 1000 * 10);
    window.addEventListener('mousemove', renewActivity);
    window.addEventListener('keydown', renewActivity);
    return () => {
      window.removeEventListener('mousemove', renewActivity);
      window.removeEventListener('keydown', renewActivity);
    };
  }, [rid, socket]);
  const handleAddGame = () => {
    const gameLink = window.prompt('Enter new game link');
    const gid = _.last(gameLink?.split('/'));
    if (gid && gid.match('[a-z0-9-]{1,15}')) {
      setGame(gid);
    }
  };
  const currentTime = useTimer();
  const currentGame = _.first(roomState.games);
  return (
    <Box sx={{display: 'flex', height: '100%', flexDirection: 'column'}}>
      <Helmet title={`Room ${rid}`} />
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          '& iframe': {
            border: 'none',
            width: '100%',
            height: '100%',
          },
        }}
      >
        {currentGame && <iframe title="game" src={`/game/${currentGame.gid}`} />}
        {!currentGame && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div>No game selected!</div>
            <div> Click the button on the bottom-right to enter a game link</div>
          </Box>
        )}
      </Box>
      <Box
        sx={{
          padding: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          background: 'var(--main-blue)',
          color: '#FBFBFB',
          '& button': {
            border: 'none',
            background: 'none',
            outline: '1px solid',
            color: '#FBFBFB',
            cursor: 'pointer',
          },
        }}
      >
        <div>
          In this room:{' '}
          {
            _.filter(roomState.users, (user) => user.lastPing > currentTime - ACTIVE_SECONDS_TIMEOUT * 1000)
              .length
          }{' '}
          <Box component="span" sx={{color: '#DDDDDD'}}>
            ({roomState.users.length} total)
          </Box>
        </div>
        <div>
          <button onClick={handleAddGame}>
            Game:
            {currentGame?.gid ?? 'N/A'}
          </button>
        </div>
      </Box>
    </Box>
  );
};
export default Room;
