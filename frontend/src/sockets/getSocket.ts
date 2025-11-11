import io from 'socket.io-client';
import {SOCKET_HOST} from '../api/constants';
import {onceAsync} from './emitAsync';

let websocketPromise: Promise<SocketIOClient.Socket>;

/**
 * Gets or creates a Socket.io client connection to the server.
 * Uses a singleton pattern to ensure only one socket instance exists.
 * The socket is configured with websocket-only transport for better connection limits.
 *
 * @returns Promise that resolves to the connected Socket.io client instance
 *
 * @example
 * ```tsx
 * const socket = await getSocket();
 * socket.emit('event', data);
 * ```
 */
export const getSocket = () => {
  if (!websocketPromise) {
    websocketPromise = (async () => {
      // Note: In attempt to increase websocket limit, use upgrade false
      // https://stackoverflow.com/questions/15872788/maximum-concurrent-socket-io-connections
      const socket = io(SOCKET_HOST, {upgrade: false, transports: ['websocket']});

      (window as any).socket = socket;

      // Register event handlers BEFORE any async operations to avoid missing events
      // Following Socket.io best practice: register handlers outside connect event
      socket.on('pong', (ms: number) => {
        (window as any).connectionStatus = {
          latency: ms,
          timestamp: Date.now(),
        };
      });

      // Debug handlers - registered once, outside connect event to avoid duplicates
      socket.on('connect', () => {
        console.debug('[ws connect]', Date.now());
      });
      socket.on('ping', () => {
        console.debug('[ws ping]', Date.now());
      });
      socket.on('pong', () => {
        console.debug('[ws pong]', Date.now());
      });

      console.log('Connecting to', SOCKET_HOST);
      // If already connected, return immediately, otherwise wait for connect event
      if (socket.connected) {
        return socket;
      }
      await onceAsync(socket, 'connect');
      return socket;
    })();
  }
  return websocketPromise;
};
