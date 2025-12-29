/**
 * Replay Page Skeleton Loader
 * Shows a loading placeholder that mimics the replay page layout
 */

import { Box, Skeleton, Stack } from '@mui/material';

const ReplaySkeleton = () => {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Timeline controls skeleton */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '16px',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1, flex: 1 }} />
        <Skeleton variant="text" width={80} height={28} />
        <Skeleton variant="circular" width={40} height={40} />
      </Box>

      {/* Replay info bar */}
      <Box sx={{ padding: '12px 16px', backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="text" width="30%" height={24} />
          <Skeleton variant="text" width="15%" height={20} />
          <Box sx={{ flexGrow: 1 }} />
          <Skeleton variant="text" width="10%" height={20} />
        </Box>
      </Box>

      {/* Game content skeleton */}
      <Box
        sx={{
          flex: 1,
          padding: { xs: 2, sm: 2, md: 3 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'hidden',
        }}
      >
        <div className="flex gap-4 w-full max-w-7xl">
          {/* Grid area */}
          <div className="flex-1 flex flex-col gap-3">
            {/* Clue bar skeleton */}
            <Skeleton variant="rectangular" width="100%" height={48} sx={{ borderRadius: 1 }} />

            {/* Grid skeleton */}
            <div className="flex justify-center">
              <Box sx={{ position: 'relative', aspectRatio: '1/1', width: '100%', maxWidth: 500 }}>
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height="100%"
                  sx={{ borderRadius: 1 }}
                />
              </Box>
            </div>

            {/* Event log skeleton */}
            <Box sx={{ marginTop: 2 }}>
              <Skeleton variant="text" width="30%" height={24} sx={{ marginBottom: 1 }} />
              <Stack spacing={1}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="text" width="80%" height={20} />
                ))}
              </Stack>
            </Box>
          </div>

          {/* Clues list skeleton */}
          <div className="hidden md:block w-80">
            <Skeleton variant="text" width="40%" height={32} sx={{ marginBottom: 2 }} />
            <Stack spacing={1.5}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={`across-${i}`}>
                  <Skeleton variant="text" width="90%" height={24} />
                </Box>
              ))}
            </Stack>
            <Skeleton
              variant="text"
              width="40%"
              height={32}
              sx={{ marginTop: 3, marginBottom: 2 }}
            />
            <Stack spacing={1.5}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={`down-${i}`}>
                  <Skeleton variant="text" width="90%" height={24} />
                </Box>
              ))}
            </Stack>
          </div>
        </div>
      </Box>
    </div>
  );
};

export default ReplaySkeleton;
