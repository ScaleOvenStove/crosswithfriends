/// <reference types="vite/client" />

import type {Socket} from 'socket.io-client';

interface ConnectionStatus {
  latency: number;
  timestamp: number;
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_ENV?: string;
    readonly VITE_USE_LOCAL_SERVER?: string;
    readonly VITE_STAGING_API_URL?: string;
    readonly VITE_API_URL?: string;
    readonly VITE_MAINTENANCE_BANNER_ACTIVE?: string;
    readonly VITE_MAINTENANCE_BANNER_MESSAGE?: string;
    readonly VITE_SITE_DOWN?: string;
    readonly MODE: string;
  }

  interface Window {
    connectionStatus?: ConnectionStatus;
    socket?: Socket;
  }
}
