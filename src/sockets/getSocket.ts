import {io, Socket} from 'socket.io-client';
import {SOCKET_HOST} from '../api/constants';

let websocketPromise: Promise<Socket>;
export const getSocket = () => {
  if (!websocketPromise) {
    websocketPromise = (async () => {
      // Note: In attempt to increase websocket limit, use upgrade false
      // https://stackoverflow.com/questions/15872788/maximum-concurrent-socket-io-connections
      const socket = io(SOCKET_HOST, {upgrade: false, transports: ['websocket']});

      (window as any).socket = socket;

      // In socket.io v4, ping/pong is handled by Engine.IO — measure round-trip latency.
      // The Manager replaces its engine on each reconnect, so we must rebind listeners
      // every time a new engine is created.
      let pingStart = 0;
      const bindEngineListeners = () => {
        socket.io.engine.on('ping', () => {
          pingStart = Date.now();
        });
        socket.io.engine.on('pong', () => {
          (window as any).connectionStatus = {
            connected: true,
            latency: pingStart ? Date.now() - pingStart : 0,
            timestamp: Date.now(),
          };
        });
      };
      bindEngineListeners();
      socket.io.on('open', bindEngineListeners);
      socket.on('disconnect', () => {
        (window as any).connectionStatus = undefined;
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
