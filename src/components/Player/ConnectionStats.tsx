import React, {useState, useEffect} from 'react';

const ConnectionStats: React.FC<{optimisticCounter?: number}> = ({optimisticCounter}) => {
  const [connectionStatus, setConnectionStatus] = useState<
    | {
        connected: boolean;
        latency: number;
        timestamp: number;
      }
    | undefined
  >();
  useEffect(() => {
    const it = setInterval(() => {
      setConnectionStatus((window as any).connectionStatus);
    }, 2000);
    return () => {
      clearInterval(it);
    };
  }, []);

  if (connectionStatus?.connected) {
    const syncLabel = optimisticCounter ? `${optimisticCounter} ahead` : 'Synced';
    return (
      <div>
        {syncLabel} ({connectionStatus.latency}ms)
      </div>
    );
  }
  return <div>Not connected</div>;
};

export default ConnectionStats;
