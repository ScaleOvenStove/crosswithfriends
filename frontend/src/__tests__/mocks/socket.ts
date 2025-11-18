/**
 * Mock implementations for Socket.IO for Vitest tests
 */
import {vi} from 'vitest';

export interface MockSocket {
  connected: boolean;
  id: string;
  emit: (event: string, ...args: unknown[]) => void;
  once: (event: string, callback: (...args: unknown[]) => void) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  disconnect: () => void;
  connect: () => void;

  _callbacks: Record<string, Array<(...args: unknown[]) => void>>;
}

export function createMockSocket(): MockSocket {
  const callbacks: Record<string, Array<(...args: unknown[]) => void>> = {};

  const socket: MockSocket = {
    connected: true,
    id: 'mock-socket-id',
    emit: vi.fn((event: string, ...args: unknown[]) => {
      // In a real test, you might want to track emitted events
      // The last argument might be a callback for acknowledgment
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function') {
        // Simulate acknowledgment
        lastArg();
      }
    }),
    once: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!callbacks[event]) {
        callbacks[event] = [];
      }
      // Auto-remove after first call
      const wrappedCallback = (...args: unknown[]) => {
        callback(...args);
        // Remove this callback from the array
        const index = callbacks[event].indexOf(wrappedCallback);
        if (index > -1) {
          callbacks[event].splice(index, 1);
        }
      };
      callbacks[event].push(wrappedCallback);
    }),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!callbacks[event]) {
        callbacks[event] = [];
      }
      callbacks[event].push(callback);
    }),
    off: vi.fn((event: string, callback?: (...args: unknown[]) => void) => {
      if (callbacks[event]) {
        if (callback) {
          callbacks[event] = callbacks[event].filter((cb) => cb !== callback);
        } else {
          delete callbacks[event];
        }
      }
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
    }),
    connect: vi.fn(() => {
      socket.connected = true;
      // Trigger connect event
      if (callbacks.connect) {
        callbacks.connect.forEach((cb) => cb());
      }
    }),

    _callbacks: callbacks,
  };

  return socket;
}

/**
 * Helper to trigger a socket event in tests
 */
export function triggerSocketEvent(socket: MockSocket, event: string, ...args: unknown[]) {
  // eslint-disable-next-line no-underscore-dangle
  if (socket._callbacks[event]) {
    // eslint-disable-next-line no-underscore-dangle
    socket._callbacks[event].forEach((callback) => callback(...args));
  }
}
