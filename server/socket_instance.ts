import type {Server} from 'socket.io';

// Lazy holder for the Socket.IO Server instance. server.ts wires the real
// Server in via setSocketIo() after construction; API handlers that need to
// emit (e.g. kick → broadcast 'kicked' to the room) read it through
// getSocketIo(). The API router is registered before the Socket.IO server is
// constructed in server.ts, so we can't just import a constant.

let io: Server | null = null;

export function setSocketIo(server: Server): void {
  io = server;
}

export function getSocketIo(): Server | null {
  return io;
}
