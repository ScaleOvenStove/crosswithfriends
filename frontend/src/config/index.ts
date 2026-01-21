/**
 * Application configuration
 *
 * Server URL Configuration:
 * - VITE_API_URL: Full API URL (e.g., http://localhost:3021) - overrides all other settings
 * - VITE_WS_URL: Full WebSocket URL (e.g., http://localhost:3021) - overrides all other settings
 * - VITE_SERVER_PORT: Server port (default: 3021) - used when VITE_USE_LOCAL_SERVER=1
 * - VITE_USE_LOCAL_SERVER: Use local server (default: false) - uses localhost with VITE_SERVER_PORT
 * - VITE_ENV: Environment mode (production, staging, development)
 */

const isLocalServer = import.meta.env.VITE_USE_LOCAL_SERVER === '1';
const isProduction = import.meta.env.VITE_ENV === 'production';
const serverPort = import.meta.env.VITE_SERVER_PORT || '3021';

const isLocalhostUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const hostname = new URL(trimmed).hostname.toLowerCase();
      return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '127.0.0.1' ||
        hostname === '::1'
      );
    } catch {
      return false;
    }
  }

  const hostPort = trimmed.split('/')[0] ?? '';
  let host: string;
  
  // Handle bracketed IPv6 addresses (e.g., [::1]:3021)
  if (hostPort.startsWith('[')) {
    const bracketEnd = hostPort.indexOf(']');
    if (bracketEnd !== -1) {
      // Extract content between brackets as the host
      host = hostPort.substring(1, bracketEnd).toLowerCase();
    } else {
      // Malformed bracketed address, fall back to splitting on last ':'
      const lastColon = hostPort.lastIndexOf(':');
      host = (lastColon !== -1 
        ? hostPort.substring(0, lastColon) 
        : hostPort).toLowerCase();
    }
  } else {
    // For non-bracketed addresses, detect IPv6 addresses
    const colonCount = (hostPort.match(/:/g) || []).length;
    if (colonCount >= 2) {
      // Two or more colons indicates a bare IPv6 address
      host = hostPort.toLowerCase();
    } else {
      // Split on last ':' only if suffix is all digits (port number)
      const lastColon = hostPort.lastIndexOf(':');
      if (lastColon !== -1) {
        const suffix = hostPort.substring(lastColon + 1);
        if (/^\d+$/.test(suffix)) {
          // Suffix is all digits, treat as port
          host = hostPort.substring(0, lastColon).toLowerCase();
        } else {
          // Suffix is not all digits, treat whole string as host
          host = hostPort.toLowerCase();
        }
      } else {
        // No colon found, treat whole string as host
        host = hostPort.toLowerCase();
      }
    }
  }
  
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1'
  );
};

const normalizeUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) {
    const scheme = isLocalhostUrl(url) ? 'http' : 'https';
    return `${scheme}://${url}`;
  }

  return url;
};

// Determine API URL with priority: VITE_API_URL > local server > production > staging
const getApiUrl = (): string => {
  // Explicit API URL takes highest priority
  if (import.meta.env.VITE_API_URL) {
    return normalizeUrl(import.meta.env.VITE_API_URL);
  }

  // Local server mode
  if (isLocalServer) {
    return `http://localhost:${serverPort}`;
  }

  // Production or staging
  return isProduction
    ? 'https://downforacross-com.onrender.com'
    : 'https://crosswithfriendsbackend-staging.onrender.com';
};

// Determine WebSocket URL with priority: VITE_WS_URL > VITE_API_URL > local server > production > staging
const getWsUrl = (): string => {
  // Explicit WebSocket URL takes highest priority
  if (import.meta.env.VITE_WS_URL) {
    return normalizeUrl(import.meta.env.VITE_WS_URL);
  }

  // Use API URL if explicitly set
  if (import.meta.env.VITE_API_URL) {
    return normalizeUrl(import.meta.env.VITE_API_URL);
  }

  // Local server mode
  if (isLocalServer) {
    return `http://localhost:${serverPort}`;
  }

  // Production or staging
  return isProduction
    ? 'https://downforacross-com.onrender.com'
    : 'https://crosswithfriendsbackend-staging.onrender.com';
};

const apiUrl = getApiUrl();
const wsUrl = getWsUrl();

export const config = {
  apiUrl,
  wsUrl,

  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },

  features: {
    enableAuth: true, // Firebase auth enabled
    enableBeta: true,
    enableChat: true,
    enableRooms: true,
    enableBattleMode: true,
    enableFencing: true,
  },
} as const;

/**
 * API Base URL for generated API client
 * Includes the /api path prefix
 */
export const API_BASE_URL = `${apiUrl}/api`;

export default config;
