import {io, Socket} from 'socket.io-client';
import {SOCKET_HOST} from '../api/constants';
import getLocalId from '../localAuth';

let websocketPromise: Promise<Socket> | undefined;
let currentAuthToken: string | null = null;

function buildAuth(): Record<string, string> {
  const auth: Record<string, string> = {};
  if (currentAuthToken) auth.token = currentAuthToken;
  const dfacId = getLocalId();
  if (dfacId) auth.dfacId = dfacId;
  return auth;
}

export function setSocketAuthToken(token: string | null) {
  if (currentAuthToken === token) return;
  currentAuthToken = token;
  // The active socket's handshake.auth was sealed at io() creation time, so
  // a guest socket keeps presenting null/old tokens even after sign-in.
  // Mutate socket.auth in place and bounce the connection so the server-side
  // checks that depend on socket.data.authUser (owner bypass in join_game,
  // verifiedUserId stamping on game_event) see the new identity. We reuse
  // the same Socket instance so GameModel's reference + 'kicked'/'connect'
  // listeners stay attached, and the reconnect handler re-issues join_game.
  if (websocketPromise) {
    websocketPromise
      .then((socket) => {
        socket.auth = buildAuth();
        if (socket.connected) socket.disconnect();
        socket.connect();
      })
      .catch(() => {});
  }
}

// Drop the cached socket promise. Used after we deliberately disconnect
// the underlying socket (forceDisconnect on kick) so the next caller gets
// a fresh connection instead of a dead one. Without this, subsequent game
// sessions in the same SPA tab would reuse the disconnected socket and
// never rejoin/sync until a full page reload.
export function resetSocket() {
  websocketPromise = undefined;
  (window as any).socket = undefined;
  (window as any).connectionStatus = undefined;
}

export const getSocket = () => {
  if (!websocketPromise) {
    websocketPromise = (async () => {
      // Try WebSocket first (fastest, full-duplex) and fall back to long-
      // polling when intermediaries strip the Upgrade headers (corporate
      // proxies, some mobile carriers, captive portals). Without the
      // fallback, those users silently fail to connect to multiplayer and
      // sit on a non-functional game page. The default `upgrade: true`
      // lets Engine.IO promote a polling connection to WebSocket on the
      // next reconnect window if the WS path frees up.
      const socketOptions: Record<string, any> = {transports: ['websocket', 'polling']};
      // dfacId always travels — it's the guest identity. The server uses
      // both this and the JWT-derived userId for ban/lock checks.
      const auth = buildAuth();
      if (Object.keys(auth).length > 0) socketOptions.auth = auth;
      const socket = io(SOCKET_HOST, socketOptions);

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
