/**
 * Centralized configuration module
 * Consolidates all environment variables, API URLs, feature flags, and app configuration
 */

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId?: string;
}

interface Config {
  env: {
    mode: string;
    isDevelopment: boolean;
    isProduction: boolean;
  };
  api: {
    baseURL: string;
    socketHost: string;
    useLocalServer: boolean;
  };
  firebase: {
    config: FirebaseConfig;
    offline: boolean;
  };
  features: {
    fencing: boolean;
    [key: string]: boolean;
  };
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  // Use nullish coalescing to preserve empty strings and only fallback for undefined
  return value ?? defaultValue ?? '';
};

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// API Configuration
const DEV_REMOTE_SERVER_URL = getEnvVar(
  'VITE_STAGING_API_URL',
  'crosswithfriendsbackend-staging.onrender.com'
);
const PROD_REMOTE_SERVER_URL = getEnvVar('VITE_API_URL', 'downforacross-com.onrender.com');
const REMOTE_SERVER = isDevelopment ? DEV_REMOTE_SERVER_URL : PROD_REMOTE_SERVER_URL;

// Use https for staging/production, http only for localhost
const REMOTE_SERVER_URL = REMOTE_SERVER.includes('localhost')
  ? `${window.location.protocol}//${REMOTE_SERVER}`
  : `https://${REMOTE_SERVER}`;

// Warn about HTTPS in development (can cause issues with local servers)
// Only warn if explicitly disallowed via environment flag
if (
  window.location.protocol === 'https' &&
  isDevelopment &&
  import.meta.env.VITE_DISALLOW_HTTPS_IN_DEV === '1'
) {
  console.warn(
    '⚠️ HTTPS detected in development mode. This may cause issues with local servers and WebSocket connections. ' +
      'Consider using HTTP for local development. To disable this warning, remove VITE_DISALLOW_HTTPS_IN_DEV from your environment.'
  );
}

const useLocalServer = getEnvVar('VITE_USE_LOCAL_SERVER', '0') === '1';
const serverUrl = useLocalServer ? 'http://localhost:3021' : REMOTE_SERVER_URL;

// Firebase Configuration
const FIREBASE_CONFIGS: Record<string, FirebaseConfig> = {
  production: {
    apiKey: 'AIzaSyCe4BWm9kbjXFwlZcmq4x8DvLD3TDoinhA',
    authDomain: 'crosswordsio.firebaseapp.com',
    databaseURL: 'https://crosswordsio.firebaseio.com',
    projectId: 'crosswordsio',
    storageBucket: 'crosswordsio.appspot.com',
    messagingSenderId: '1021412055058',
  },
  development: {
    apiKey: 'AIzaSyC4Er27aLKgSK4u2Z8aRfD6mr8AvLPA8tA',
    authDomain: 'dfac-fa059.firebaseapp.com',
    databaseURL: 'https://dfac-fa059.firebaseio.com',
    projectId: 'dfac-fa059',
    storageBucket: 'dfac-fa059.appspot.com',
    messagingSenderId: '132564774895',
    appId: '1:132564774895:web:a3bf48cd38c4df81e8901a',
  },
};

const env = getEnvVar('VITE_ENV', import.meta.env.MODE);
const selectedFirebaseConfig = FIREBASE_CONFIGS[env] || FIREBASE_CONFIGS.development;

export const config: Config = {
  env: {
    mode: import.meta.env.MODE || 'development',
    isDevelopment,
    isProduction,
  },
  api: {
    baseURL: serverUrl,
    socketHost: serverUrl,
    useLocalServer,
  },
  firebase: {
    config: selectedFirebaseConfig,
    offline: false,
  },
  features: {
    fencing: true,
  },
};

// Export individual config sections for convenience
export const {env: envConfig, api: apiConfig, firebase: firebaseConfig, features: featureFlags} = config;

// Export commonly used values
export const SERVER_URL = apiConfig.baseURL;
export const SOCKET_HOST = apiConfig.socketHost;
export const IS_DEVELOPMENT = envConfig.isDevelopment;
export const IS_PRODUCTION = envConfig.isProduction;
