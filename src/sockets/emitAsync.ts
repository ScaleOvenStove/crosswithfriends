import type {Socket} from 'socket.io-client';

export const emitAsync = (socket: Socket, ...args: any[]) =>
  new Promise((resolve) => {
    (socket as any).emit(...args, resolve);
  });
