const DEV_REMOTE_SERVER_URL =
  process.env.STAGING_REACT_APP_API_URL || 'staging-downforacross-com.onrender.com';
const PROD_REMOTE_SERVER_URL = process.env.REACT_APP_API_URL || 'downforacross-com.onrender.com';
const REMOTE_SERVER = process.env.NODE_ENV === 'development' ? DEV_REMOTE_SERVER_URL : PROD_REMOTE_SERVER_URL;
const REMOTE_SERVER_URL = `${window.location.protocol}//${REMOTE_SERVER}`;
if (window.location.protocol === 'https' && process.env.NODE_ENV === 'development') {
  throw new Error('Please use http in development');
}

export const SERVER_URL = process.env.REACT_APP_USE_LOCAL_SERVER
  ? 'http://localhost:3021'
  : REMOTE_SERVER_URL;

// socket.io server is same as api server
export const SOCKET_HOST = SERVER_URL;
