import React, {useEffect, useMemo, useState} from 'react';
import {useUpdateEffect} from 'react-use';
import _ from 'lodash';
import {Helmet} from 'react-helmet';
import {useParams} from 'react-router-dom';

import {Box} from '@mui/material';
import type {RoomEvent} from '@crosswithfriends/shared/roomEvents';
import {initialRoomState, roomReducer} from '@crosswithfriends/shared/lib/reducers/room';
import {useRoom} from '../hooks/useRoom';

const ACTIVE_SECONDS_TIMEOUT = 60;

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
  const {events, sendUserPing, setGame} = useRoom({rid});
  const roomState = useRoomState(events);

  useUpdateEffect(() => {
    sendUserPing();
  }, [rid, sendUserPing]);

  useUpdateEffect(() => {
    const renewActivity = _.throttle(sendUserPing, 1000 * 10);
    window.addEventListener('mousemove', renewActivity);
    window.addEventListener('keydown', renewActivity);
    return () => {
      window.removeEventListener('mousemove', renewActivity);
      window.removeEventListener('keydown', renewActivity);
    };
  }, [rid, sendUserPing]);
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
