const REMOTE_SERVER = process.env.REACT_APP_API_URL || 'downforacross-com.onrender.com';
const REMOTE_SERVER_URL = `https://${REMOTE_SERVER}`;
if (window.location.protocol === 'https' && process.env.NODE_ENV === 'development') {
  throw new Error('Please use http in development');
}

// Local dev with local server: direct to localhost
// Local dev without local server: '' → CRA proxy forwards /api/* to remote backend
// Production build: '' → same-origin through Render rewrite proxy
function getServerUrl() {
  if (process.env.REACT_APP_USE_LOCAL_SERVER) return 'http://localhost:3021';
  return '';
}
export const SERVER_URL = getServerUrl();

// Socket.IO always connects directly to backend (WebSocket, token auth, no cookies)
export const SOCKET_HOST = process.env.REACT_APP_USE_LOCAL_SERVER
  ? 'http://localhost:3021'
  : REMOTE_SERVER_URL;

console.log('--------------------------------------------------------------------------------');
console.log('Frontend API Protocol:', window.location.protocol);
console.log('Frontend API at:', SERVER_URL || '(same-origin)');
console.log('Frontend Socket at:', SOCKET_HOST);
console.log('--------------------------------------------------------------------------------');
