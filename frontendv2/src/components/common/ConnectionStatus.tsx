/**
 * Connection Status Indicator
 * Shows WebSocket connection state in the UI
 */

import { useSocket } from '@sockets/index';

const ConnectionStatus = () => {
  const { isConnected } = useSocket();

  if (isConnected) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg"
        title="Connected to real-time server"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs font-medium text-green-700">Connected</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg"
      title="Disconnected from real-time server. Some features may be unavailable."
    >
      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
      <span className="text-xs font-medium text-yellow-700">Offline</span>
    </div>
  );
};

export default ConnectionStatus;
