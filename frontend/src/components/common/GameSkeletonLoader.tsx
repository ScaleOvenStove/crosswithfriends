import {Box, Skeleton, Stack} from '@mui/material';
import React from 'react';

/**
 * Skeleton loader for the game page that matches the game layout
 */
const GameSkeletonLoader: React.FC = () => {
  return (
    <Stack direction="column" sx={{flex: 1, width: '100%', height: '100%'}}>
      {/* Toolbar skeleton */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '15px 10px 13px 50px',
          borderTop: '1px solid #e2e2e2',
          borderLeft: '1px solid #e2e2e2',
          borderBottom: '1px solid #e2e2e2',
        }}
      >
        <Skeleton variant="text" width={80} height={24} />
        <Skeleton variant="rectangular" width={70} height={36} sx={{borderRadius: 1}} />
        <Skeleton variant="rectangular" width={70} height={36} sx={{borderRadius: 1}} />
        <Skeleton variant="rectangular" width={70} height={36} sx={{borderRadius: 1}} />
        <Skeleton variant="circular" width={32} height={32} />
      </Box>

      {/* Puzzle info skeleton */}
      <Box sx={{padding: {xs: '8px', sm: '12px 16px'}, flexShrink: 0}}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            padding: {xs: '10px 12px', sm: '12px 16px'},
            backgroundColor: 'rgba(106, 169, 244, 0.08)',
            borderRadius: '8px',
            marginBottom: '12px',
          }}
        >
          <Box sx={{flex: 1}}>
            <Skeleton variant="text" width="60%" height={24} sx={{marginBottom: 1}} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </Box>
      </Box>

      {/* Game grid skeleton */}
      <Box
        sx={{
          flex: 1,
          padding: {xs: 0, sm: 1, md: 2, lg: 3},
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{display: 'flex', gap: 2, width: '100%', maxWidth: '1200px'}}>
          {/* Grid area */}
          <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Clue bar skeleton */}
            <Skeleton variant="rectangular" width="100%" height={44} sx={{borderRadius: 1}} />
            {/* Grid skeleton */}
            <Box sx={{display: 'flex', justifyContent: 'center'}}>
              <Skeleton
                variant="rectangular"
                width={400}
                height={400}
                sx={{borderRadius: 1, aspectRatio: '1/1'}}
              />
            </Box>
          </Box>

          {/* Clues list skeleton */}
          <Box sx={{width: {xs: '100%', sm: '300px'}, display: {xs: 'none', sm: 'block'}}}>
            <Skeleton variant="text" width="40%" height={28} sx={{marginBottom: 2}} />
            <Stack spacing={1}>
              {Array.from({length: 5}).map((_, i) => (
                <Skeleton key={i} variant="text" width="100%" height={24} />
              ))}
            </Stack>
            <Skeleton variant="text" width="40%" height={28} sx={{marginTop: 3, marginBottom: 2}} />
            <Stack spacing={1}>
              {Array.from({length: 5}).map((_, i) => (
                <Skeleton key={i} variant="text" width="100%" height={24} />
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Stack>
  );
};

export default GameSkeletonLoader;

