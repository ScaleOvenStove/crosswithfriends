const REMOTE_SERVER = import.meta.env.VITE_API_URL || 'downforacross-com.onrender.com';
const REMOTE_SERVER_URL = `https://${REMOTE_SERVER}`;
if (window.location.protocol === 'https' && import.meta.env.DEV) {
  throw new Error('Please use http in development');
}

// Local dev with local server: direct to localhost
// Local dev without local server: '' → Vite proxy forwards /api/* to remote backend
// Production build: '' → same-origin through Render rewrite proxy
function getServerUrl() {
  if (import.meta.env.VITE_USE_LOCAL_SERVER) return 'http://localhost:3021';
  return '';
}
export const SERVER_URL = getServerUrl();

// Socket.IO always connects directly to backend (WebSocket, token auth, no cookies)
// Self-hosted (Docker): use same-origin since backend serves everything
function getSocketHost() {
  if (import.meta.env.VITE_USE_LOCAL_SERVER) return 'http://localhost:3021';
  if (import.meta.env.VITE_SELF_HOSTED) return window.location.origin;
  return REMOTE_SERVER_URL;
}
export const SOCKET_HOST = getSocketHost();

console.log('--------------------------------------------------------------------------------');
console.log('Frontend API Protocol:', window.location.protocol);
console.log('Frontend API at:', SERVER_URL || '(same-origin)');
console.log('Frontend Socket at:', SOCKET_HOST);
console.log('--------------------------------------------------------------------------------');
