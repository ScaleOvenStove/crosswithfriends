/**
 * Centralized Socket Manager
 * Manages singleton socket instance, subscriptions, and automatic cleanup
 */

import io, {type Socket} from 'socket.io-client';
import {SOCKET_HOST} from '../api/constants';

// Helper to wait for a socket event once
const onceAsync = (socket: Socket, event: string): Promise<void> =>
  new Promise((resolve) => {
    socket.once(event, resolve);
  });

type EventHandler = (...args: unknown[]) => void;
type Unsubscribe = () => void;

class SocketManager {
  private socket: Socket | null = null;
  private socketPromise: Promise<Socket> | null = null;
  private subscriptions: Map<string, Set<EventHandler>> = new Map();
  private isConnecting = false;

  /**
   * Get or create the socket connection
   */
  async connect(): Promise<Socket> {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socketPromise) {
      return this.socketPromise;
    }

    this.isConnecting = true;
    this.socketPromise = this.createConnection();
    return this.socketPromise;
  }

  /**
   * Create a new socket connection
   */
  private async createConnection(): Promise<Socket> {
    const socket = io(SOCKET_HOST, {upgrade: false, transports: ['websocket']});

    // Store socket on window for debugging (only in development)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      (window as {socket?: Socket}).socket = socket;
    }

    // Register global event handlers
    socket.on('pong', (ms: number) => {
      if (typeof window !== 'undefined') {
        (window as {connectionStatus?: {latency: number; timestamp: number}}).connectionStatus = {
          latency: ms,
          timestamp: Date.now(),
        };
      }
    });

    // Debug handlers
    if (import.meta.env.DEV) {
      socket.on('connect', () => {
        console.debug('[ws connect]', Date.now());
      });
      socket.on('ping', () => {
        console.debug('[ws ping]', Date.now());
      });
      socket.on('pong', () => {
        console.debug('[ws pong]', Date.now());
      });
    }

    console.log('Connecting to', SOCKET_HOST);

    // Wait for connection
    if (!socket.connected) {
      await new Promise<void>((resolve) => {
        socket.once('connect', resolve);
      });
    }

    this.socket = socket;
    this.isConnecting = false;

    // Re-register all subscriptions after connection
    this.reconnectSubscriptions();

    return socket;
  }

  /**
   * Re-register all subscriptions after reconnection
   */
  private reconnectSubscriptions(): void {
    if (!this.socket) return;

    this.subscriptions.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket?.on(event, handler);
      });
    });
  }

  /**
   * Subscribe to a socket event
   * Returns an unsubscribe function
   */
  subscribe(event: string, handler: EventHandler): Unsubscribe {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }

    this.subscriptions.get(event)?.add(handler);

    // If socket is already connected, register the handler immediately
    if (this.socket?.connected) {
      this.socket.on(event, handler);
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(event);
      handlers?.delete(handler);

      if (handlers?.size === 0) {
        this.subscriptions.delete(event);
      }

      if (this.socket) {
        this.socket.off(event, handler);
      }
    };
  }

  /**
   * Emit an event
   */
  async emit(event: string, ...args: unknown[]): Promise<void> {
    const socket = await this.connect();

    // Wait for connection if not connected
    if (!socket.connected) {
      await onceAsync(socket, 'connect');
    }

    socket.emit(event, ...args);
  }

  /**
   * Emit an event and wait for acknowledgment
   */
  async emitAsync(event: string, ...args: unknown[]): Promise<unknown> {
    const socket = await this.connect();

    // Wait for connection if not connected
    if (!socket.connected) {
      await onceAsync(socket, 'connect');
    }

    return new Promise((resolve) => {
      (socket as {emit: (...args: unknown[]) => void}).emit(event, ...args, resolve);
    });
  }

  /**
   * Get the current socket instance (may be null if not connected)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Disconnect the socket and clean up all subscriptions
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.subscriptions.clear();
    this.socketPromise = null;
    this.isConnecting = false;
  }

  /**
   * Clean up all subscriptions for a specific event
   */
  unsubscribeAll(event: string): void {
    const handlers = this.subscriptions.get(event);
    if (handlers && this.socket) {
      handlers.forEach((handler) => {
        this.socket?.off(event, handler);
      });
    }
    this.subscriptions.delete(event);
  }
}

// Create singleton instance
export const socketManager = new SocketManager();

// Export default instance
export default socketManager;

