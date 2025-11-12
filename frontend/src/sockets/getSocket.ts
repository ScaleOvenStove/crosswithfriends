import socketManager from './SocketManager';
import {type Socket} from 'socket.io-client';

/**
 * Gets or creates a Socket.io client connection to the server.
 * Uses SocketManager singleton to ensure only one socket instance exists.
 * Maintains backward compatibility with existing code.
 *
 * @returns Promise that resolves to the connected Socket.io client instance
 *
 * @example
 * ```tsx
 * const socket = await getSocket();
 * socket.emit('event', data);
 * ```
 */
export const getSocket = async (): Promise<Socket> => {
  return socketManager.connect();
};
