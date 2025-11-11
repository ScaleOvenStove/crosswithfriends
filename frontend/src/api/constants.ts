const DEV_REMOTE_SERVER_URL =
  import.meta.env.VITE_STAGING_API_URL || 'crosswithfriendsbackend-staging.onrender.com';
const PROD_REMOTE_SERVER_URL = import.meta.env.VITE_API_URL || 'downforacross-com.onrender.com';
const REMOTE_SERVER = import.meta.env.MODE === 'development' ? DEV_REMOTE_SERVER_URL : PROD_REMOTE_SERVER_URL;
// Use https for staging/production, http only for localhost
const REMOTE_SERVER_URL = REMOTE_SERVER.includes('localhost')
  ? `${window.location.protocol}//${REMOTE_SERVER}`
  : `https://${REMOTE_SERVER}`;
if (window.location.protocol === 'https' && import.meta.env.MODE === 'development') {
  throw new Error('Please use http in development');
}

// Use staging API by default (can be overridden with VITE_USE_LOCAL_SERVER=1)
export const SERVER_URL =
  import.meta.env.VITE_USE_LOCAL_SERVER === '1' ? 'http://localhost:3021' : REMOTE_SERVER_URL;

// socket.io server is same as api server
export const SOCKET_HOST = SERVER_URL;
