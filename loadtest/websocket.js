// Load test: Socket.IO / WebSocket connections.
//
// Simulates concurrent players joining games, sending events, and
// disconnecting — the pattern that causes the most real-world load.
//
// k6 doesn't have native Socket.IO support, so we use the raw WebSocket
// API with the Socket.IO protocol (EIO=4, transport=websocket).
//
// Environment variables:
//   BASE_URL   – target server (default: http://localhost:3021)
//   TEST_GIDS  – comma-separated game IDs to join (default: test-game-1)

import ws from 'k6/ws';
import {check, sleep} from 'k6';
import {Rate, Counter, Trend} from 'k6/metrics';
import {getStages} from './config.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3021';
const WS_URL = BASE_URL.replace(/^http/, 'ws');

const connectionDuration = new Trend('ws_connection_duration', true);
const messagesSent = new Counter('ws_messages_sent');
const messagesReceived = new Counter('ws_messages_received');
const connectionErrors = new Rate('ws_connection_errors');

export const options = {
  stages: getStages(),
  thresholds: {
    ws_connection_errors: ['rate<0.05'], // less than 5% connection failures
    ws_connecting: ['p(95)<2000'], // handshake within 2s
  },
};

// Socket.IO uses Engine.IO protocol: "4" prefix for EIO v4
// Message types: 0=open, 2=ping, 3=pong, 4=message
// Socket.IO packet types (inside message): 0=connect, 2=event, 3=ack

function encodeSocketIOEvent(event, data) {
  // Socket.IO event message: EIO message (4) + SIO event (2) + JSON
  return '42' + JSON.stringify([event, data]);
}

export default function () {
  // Default gids from seed.sql (lt-game-1 through lt-game-2000)
  const gids = __ENV.TEST_GIDS
    ? __ENV.TEST_GIDS.split(',')
    : ['lt-game-1', 'lt-game-10', 'lt-game-50', 'lt-game-100'];
  const gid = gids[Math.floor(Math.random() * gids.length)];
  const socketUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

  const startTime = Date.now();

  const res = ws.connect(socketUrl, {}, function (socket) {
    let connected = false;

    socket.on('open', function () {
      connectionDuration.add(Date.now() - startTime);
      connected = true;
    });

    socket.on('message', function (msg) {
      messagesReceived.add(1);

      // Engine.IO open packet — respond to start Socket.IO handshake
      if (msg.startsWith('0{')) {
        // Send Socket.IO connect packet (namespace /)
        socket.send('40');
        return;
      }

      // Socket.IO connect ack — we're now connected, join a game
      if (msg === '40' || msg.startsWith('40{')) {
        // Join game room
        socket.send(encodeSocketIOEvent('join_game', gid));
        messagesSent.add(1);

        // Simulate user activity: send a few game events
        sleep(0.5);

        // Send cursor update (ephemeral event — broadcast only, not persisted)
        socket.send(
          encodeSocketIOEvent('game_event', {
            gid,
            event: {
              type: 'updateCursor',
              params: {
                cell: {r: 0, c: 0},
                id: `k6-user-${__VU}`,
                timestamp: Date.now(),
              },
            },
          })
        );
        messagesSent.add(1);

        sleep(0.3);

        // Request sync (triggers DB read of all game events)
        socket.send(encodeSocketIOEvent('sync_all_game_events', gid));
        messagesSent.add(1);
        return;
      }

      // Engine.IO ping — respond with pong
      if (msg === '2') {
        socket.send('3');
        return;
      }
    });

    socket.on('error', function (e) {
      connectionErrors.add(1);
      console.error(`WebSocket error: ${e}`);
    });

    // Hold connection open to simulate real user session
    sleep(3);

    // Leave game before disconnecting
    if (connected) {
      socket.send(encodeSocketIOEvent('leave_game', gid));
      messagesSent.add(1);
    }

    socket.close();
  });

  check(res, {
    'ws: connected successfully': (r) => r && r.status === 101,
  });

  sleep(1);
}
