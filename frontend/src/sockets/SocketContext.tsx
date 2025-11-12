/**
 * Socket Context Provider
 * Provides socket access via React Context with automatic cleanup
 */

import React, {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {type Socket} from 'socket.io-client';
import socketManager from './SocketManager';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, ...args: unknown[]) => Promise<void>;
  emitAsync: (event: string, ...args: unknown[]) => Promise<unknown>;
  subscribe: (event: string, handler: (...args: unknown[]) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({children}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        const connectedSocket = await socketManager.connect();
        if (mounted) {
          setSocket(connectedSocket);
          setIsConnected(connectedSocket.connected);
        }

        // Update connection status
        const updateConnectionStatus = () => {
          if (mounted) {
            setIsConnected(connectedSocket.connected);
          }
        };

        connectedSocket.on('connect', updateConnectionStatus);
        connectedSocket.on('disconnect', updateConnectionStatus);

        // Cleanup
        return () => {
          connectedSocket.off('connect', updateConnectionStatus);
          connectedSocket.off('disconnect', updateConnectionStatus);
        };
      } catch (error) {
        console.error('Failed to connect socket:', error);
        if (mounted) {
          setSocket(null);
          setIsConnected(false);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
    };
  }, []);

  const emit = async (event: string, ...args: unknown[]): Promise<void> => {
    await socketManager.emit(event, ...args);
  };

  const emitAsync = async (event: string, ...args: unknown[]): Promise<unknown> => {
    return socketManager.emitAsync(event, ...args);
  };

  const subscribe = (event: string, handler: (...args: unknown[]) => void): (() => void) => {
    return socketManager.subscribe(event, handler);
  };

  const value: SocketContextValue = {
    socket,
    isConnected,
    emit,
    emitAsync,
    subscribe,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Hook to access socket context
 */
export const useSocketContext = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
};

