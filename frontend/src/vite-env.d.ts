/// <reference types="vite/client" />

import type {Socket} from 'socket.io-client';

interface ImportMetaEnv {
  readonly VITE_ENV?: string;
  readonly VITE_USE_LOCAL_SERVER?: string;
  readonly VITE_STAGING_API_URL?: string;
  readonly VITE_API_URL?: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ConnectionStatus {
  latency: number;
  timestamp: number;
}

declare global {
  interface Window {
    connectionStatus?: ConnectionStatus;
    socket?: Socket;
  }
}
