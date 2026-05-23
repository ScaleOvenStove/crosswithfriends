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
      // Start with long-polling (works on every network we care about,
      // including ones that strip WebSocket Upgrade headers — corporate
      // proxies, some mobile carriers, captive portals) and let Engine.IO
      // upgrade to WebSocket once connected. This is the canonical
      // Engine.IO transport order and the recommended approach when you
      // care about connection reliability — it guarantees a connection
      // for any user whose network can handle plain HTTP requests.
      //
      // Trade-off: ~1 extra polling round-trip on initial connect for
      // users on healthy WS networks (most of them). The upgrade itself
      // happens transparently and subsequent traffic is full-duplex over
      // WS as before. Worth it to make multiplayer reachable for the
      // tail of users behind WS-hostile intermediaries.
      const socketOptions: Record<string, any> = {transports: ['polling', 'websocket']};
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
