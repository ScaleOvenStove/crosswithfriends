import type {Socket} from 'socket.io-client';

export const emitAsync = (socket: Socket, ...args: any[]) =>
  new Promise((resolve) => {
    (socket as any).emit(...args, resolve);
  });

export const emitAsyncWithTimeout = (socket: Socket, timeout: number, ...args: any[]) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Socket emit timed out'));
    }, timeout);
    (socket as any).emit(...args, (...ackArgs: any[]) => {
      clearTimeout(timer);
      resolve(ackArgs.length <= 1 ? ackArgs[0] : ackArgs);
    });
  });
