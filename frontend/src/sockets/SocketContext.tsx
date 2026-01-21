/**
 * Socket.io Context Provider
 * Implements REQ-10.3: Real-Time Communication via Socket.io
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback as _useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '@config/index';
import { getBackendToken } from '@services/authTokenService';
import { socketRecoveryService } from '@services/socketRecoveryService';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = async () => {
    if (socketRef.current?.connected) {
      return;
    }

    // Socket connection is being established
    // Include backend JWT token if available
    const backendToken = await getBackendToken();

    const socket = io(config.wsUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 10000,
      auth: backendToken ? { token: backendToken } : undefined,
    });

    socket.on('connect', () => {
      // Socket connected successfully
      setIsConnected(true);
      // Notify recovery service
      socketRecoveryService.handleReconnect(socket, null);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      setIsConnected(false);
      // Notify recovery service
      socketRecoveryService.handleDisconnect(reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
      console.warn(
        '[Socket] Server may be sleeping or unreachable. Real-time features will be unavailable.'
      );
      setIsConnected(false);
      socketRecoveryService.handleDisconnect(error.message);
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.warn(`[Socket] Reconnection attempt ${attempt}...`);
      socketRecoveryService.handleReconnectAttempt(attempt);
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after all attempts');
      socketRecoveryService.handleReconnectFailed();
    });

    socketRef.current = socket;
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketProvider;
