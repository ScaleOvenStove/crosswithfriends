import {Box, Tooltip,CircularProgress} from '@mui/material';
import React, {useState, useEffect} from 'react';
import {MdCheckCircle, MdSync, MdWarning} from 'react-icons/md';

interface ConnectionStatusIndicatorProps {
  optimisticCounter?: number;
}

type ConnectionStatus = 'synced' | 'connecting' | 'disconnected' | 'syncing';

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({optimisticCounter}) => {
  const [connectionStatus, setConnectionStatus] = useState<
    | {
        latency: number;
        timestamp: number;
      }
    | undefined
  >();
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  useEffect(() => {
    const it = setInterval(() => {
      setConnectionStatus((window as any).connectionStatus);
      const socket = (window as any).socket;
      setSocketConnected(socket?.connected ?? false);
      setCurrentTime(Date.now());
    }, 100);
    return () => {
      clearInterval(it);
    };
  }, []);

  // Determine connection status
  const status: ConnectionStatus = (() => {
    if (!socketConnected) {
      return 'disconnected';
    }
    if (optimisticCounter && optimisticCounter > 0) {
      return 'syncing';
    }
    if (connectionStatus) {
      return 'synced';
    }
    // Don't show "connecting" state - just show as synced if socket is connected
    // This prevents the "Connecting..." message from appearing during normal operation
    return 'synced';
  })();

  // Get connection quality based on latency
  const getConnectionQuality = (): 'good' | 'fair' | 'poor' => {
    if (!connectionStatus) return 'good';
    if (connectionStatus.latency < 100) return 'good';
    if (connectionStatus.latency < 300) return 'fair';
    return 'poor';
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'synced':
        return '#4caf50'; // green
      case 'connecting':
      case 'syncing':
        return '#ff9800'; // yellow/orange
      case 'disconnected':
        return '#f44336'; // red
      default:
        return '#757575'; // gray
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'synced':
        return <MdCheckCircle size={16} color={getStatusColor()} />;
      case 'connecting':
      case 'syncing':
        return status === 'syncing' ? (
          <CircularProgress size={14} thickness={4} sx={{color: getStatusColor()}} />
        ) : (
          <MdSync size={16} color={getStatusColor()} style={{animation: 'spin 1s linear infinite'}} />
        );
      case 'disconnected':
        return <MdWarning size={16} color={getStatusColor()} />;
      default:
        return null;
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'connecting':
        return 'Connecting...';
      case 'syncing':
        return `${optimisticCounter} pending`;
      case 'disconnected':
        return 'Disconnected';
      default:
        return '';
    }
  };

  const getTooltipText = (): string => {
    if (status === 'synced' && connectionStatus) {
      const quality = getConnectionQuality();
      return `Synced (${connectionStatus.latency}ms, ${quality})`;
    }
    if (status === 'syncing') {
      return `${optimisticCounter} change${optimisticCounter === 1 ? '' : 's'} pending sync`;
    }
    return getStatusText();
  };

  // Only show latency when synced and it's relevant (not too old)
  const showLatency = status === 'synced' && connectionStatus && currentTime - connectionStatus.timestamp < 5000;

  return (
    <Tooltip title={getTooltipText()} arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: '0.75rem',
          color: 'text.secondary',
          padding: '2px 4px',
        }}
      >
        {getStatusIcon()}
        <span style={{color: getStatusColor(), fontWeight: status === 'synced' ? 500 : 400}}>
          {getStatusText()}
        </span>
        {showLatency && connectionStatus && (
          <span style={{fontSize: '0.7rem', opacity: 0.7}}>
            ({connectionStatus.latency}ms)
          </span>
        )}
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </Box>
    </Tooltip>
  );
};

export default ConnectionStatusIndicator;

