import {useState} from 'react';
import {useAsync} from 'react-use';
import type {Socket as SocketIOClient} from 'socket.io-client';

import {getSocket} from './getSocket';

/**
 * React hook that provides access to the Socket.io client instance.
 * The socket is initialized asynchronously and will be undefined until connected.
 *
 * @returns The Socket.io client instance, or undefined if not yet connected
 *
 * @example
 * ```tsx
 * const socket = useSocket();
 * if (socket) {
 *   socket.emit('event', data);
 * }
 * ```
 */
export const useSocket = () => {
  const [socket, setSocket] = useState<SocketIOClient>();
  useAsync(async () => {
    setSocket(await getSocket());
  });
  return socket;
};
