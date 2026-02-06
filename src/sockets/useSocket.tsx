import {useState} from 'react';
import {useAsync} from 'react-use';
import type {Socket} from 'socket.io-client';
import {getSocket} from './getSocket';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket>();
  useAsync(async () => {
    setSocket(await getSocket());
  });
  return socket;
};
