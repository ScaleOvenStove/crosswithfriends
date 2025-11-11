/**
 * Emits a Socket.io event and returns a Promise that resolves when the server acknowledges it.
 * This is a wrapper around socket.emit that provides promise-based async/await support.
 *
 * @param socket - The Socket.io client instance
 * @param args - Event name and data arguments (same as socket.emit)
 * @returns Promise that resolves when the server acknowledges the event
 *
 * @example
 * ```tsx
 * await emitAsync(socket, 'join_game', gameId);
 * ```
 */
export const emitAsync = (socket: SocketIOClient.Socket, ...args: any[]) =>
  new Promise((resolve) => {
    (socket as any).emit(...args, resolve);
  });

/**
 * Listens for a Socket.io event once and returns a Promise that resolves with the event data.
 *
 * @param socket - The Socket.io client instance
 * @param event - The event name to listen for
 * @returns Promise that resolves with the event data when the event is received
 *
 * @example
 * ```tsx
 * const data = await onceAsync(socket, 'connect');
 * ```
 */
export const onceAsync = (socket: SocketIOClient.Socket, event: string): Promise<any> =>
  new Promise((resolve) => {
    socket.once(event, resolve);
  });
