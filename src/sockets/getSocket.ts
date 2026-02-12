import {io, Socket} from 'socket.io-client';
import {SOCKET_HOST} from '../api/constants';

let websocketPromise: Promise<Socket>;
let currentAuthToken: string | null = null;

export function setSocketAuthToken(token: string | null) {
  currentAuthToken = token;
}

export const getSocket = () => {
  if (!websocketPromise) {
    websocketPromise = (async () => {
      // Note: In attempt to increase websocket limit, use upgrade false
      // https://stackoverflow.com/questions/15872788/maximum-concurrent-socket-io-connections
      const socketOptions: Record<string, any> = {upgrade: false, transports: ['websocket']};
      if (currentAuthToken) {
        socketOptions.auth = {token: currentAuthToken};
      }
      const socket = io(SOCKET_HOST, socketOptions);

      (window as any).socket = socket;

      socket.on('pong', (ms: number) => {
        (window as any).connectionStatus = {
          latency: ms,
          timestamp: Date.now(),
        };
      });

      console.log('Connecting to', SOCKET_HOST);
      await new Promise<void>((resolve) => {
        socket.once('connect', resolve);
      });
      return socket;
    })();
  }
  return websocketPromise;
};
