import React, {Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState} from 'react';
import {useUpdateEffect} from 'react-use';
import _ from 'lodash';
import {Helmet} from 'react-helmet-async';
import {useParams} from 'react-router';

import type {Socket} from 'socket.io-client';
import {RoomEvent, SetGameRoomEvent, UserPingRoomEvent} from '../shared/roomEvents';
import {useSocket} from '../sockets/useSocket';
import {initialRoomState, roomReducer} from '../lib/reducers/room';
import {emitAsync} from '../sockets/emitAsync';
import './css/room.css';

const ACTIVE_SECONDS_TIMEOUT = 60;
function subscribeToRoomEvents(
  socket: Socket | undefined,
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
  const {rid} = useParams<'rid'>() as {rid: string};
  const socket = useSocket();
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const roomState = useRoomState(events);

  async function sendUserPing() {
    if (socket) {
      const event = UserPingRoomEvent();
      emitAsync(socket, 'room_event', {rid, event});
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function setGame(gid: string) {
    if (socket) {
      const event = SetGameRoomEvent(gid);
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
  const handleAddGame = useCallback(() => {
    const gameLink = window.prompt('Enter new game link');
    const gid = _.last(gameLink?.split('/'));
    if (gid && gid.match('[a-z0-9-]{1,15}')) {
      setGame(gid);
    }
  }, [setGame]);
  const currentTime = useTimer();
  const currentGame = _.first(roomState.games);
  return (
    <div className="room--container">
      <Helmet title={`Room ${rid}`} />
      <div className="room--content">
        {currentGame && <iframe title="game" src={`/game/${currentGame.gid}`} />}
        {!currentGame && (
          <div className="room--no-game-message">
            <div>No game selected!</div>
            <div> Click the button on the bottom-right to enter a game link</div>
          </div>
        )}
      </div>
      <div className="room--footer">
        <div>
          In this room:{' '}
          {
            _.filter(roomState.users, (user) => user.lastPing > currentTime - ACTIVE_SECONDS_TIMEOUT * 1000)
              .length
          }{' '}
          <span className="room--total-users-paren">({roomState.users.length} total)</span>
        </div>
        <div>
          <button type="button" onClick={handleAddGame}>
            Game:
            {currentGame?.gid ?? 'N/A'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default Room;
