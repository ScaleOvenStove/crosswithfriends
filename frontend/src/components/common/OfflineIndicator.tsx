import {Box, Chip, LinearProgress} from '@mui/material';
import React, {useEffect, useState} from 'react';

import {useOfflineStore} from '../../store/offlineStore';
import {offlineManager} from '../../utils/offlineManager';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(offlineManager.isOnline());
  const queuedActions = useOfflineStore((state) => state.queuedActions);
  const syncInProgress = useOfflineStore((state) => state.syncInProgress);

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe((status) => {
      setIsOnline(status === 'online');
      useOfflineStore.getState().setIsOnline(status === 'online');
    });

    return unsubscribe;
  }, []);

  if (isOnline && queuedActions.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: isOnline ? '#4caf50' : '#f44336',
        color: 'white',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {isOnline ? (
        <>
          <Box sx={{fontSize: '20px'}}>📶</Box>
          <Box sx={{flex: 1}}>
            {syncInProgress ? (
              <>
                <Box sx={{fontSize: '14px', marginBottom: '4px'}}>Syncing actions...</Box>
                <LinearProgress color="inherit" sx={{height: '2px'}} />
              </>
            ) : queuedActions.length > 0 ? (
              <Box sx={{fontSize: '14px'}}>
                {queuedActions.length} action{queuedActions.length !== 1 ? 's' : ''} queued for sync
              </Box>
            ) : (
              <Box sx={{fontSize: '14px'}}>Back online</Box>
            )}
          </Box>
        </>
      ) : (
        <>
          <Box sx={{fontSize: '20px'}}>📵</Box>
          <Box sx={{flex: 1, fontSize: '14px'}}>
            You're offline. Actions will be synced when you're back online.
          </Box>
          {queuedActions.length > 0 && (
            <Chip
              label={`${queuedActions.length} queued`}
              size="small"
              sx={{backgroundColor: 'rgba(255,255,255,0.2)'}}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default OfflineIndicator;
