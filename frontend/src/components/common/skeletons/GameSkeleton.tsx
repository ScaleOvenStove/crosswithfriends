/**
 * Game Page Skeleton Loader
 * Shows a loading placeholder that mimics the game page layout
 */

import { Box, Skeleton, Stack } from '@mui/material';

const GameSkeleton = () => {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar skeleton */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '12px 16px',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Skeleton variant="text" width={100} height={28} />
        <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
        <Box sx={{ flexGrow: 1 }} />
        <Skeleton variant="circular" width={36} height={36} />
      </Box>

      {/* Puzzle info skeleton */}
      <Box sx={{ padding: { xs: '12px', sm: '16px' }, flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '12px 16px',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            borderRadius: '8px',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={28} sx={{ marginBottom: 0.5 }} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="circular" width={36} height={36} />
          <Skeleton variant="circular" width={36} height={36} />
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
                {/* Grid cell overlays for visual interest */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(15, 1fr)',
                    gridTemplateRows: 'repeat(15, 1fr)',
                    gap: '1px',
                    padding: 1,
                  }}
                >
                  {Array.from({ length: 225 }).map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        backgroundColor: i % 7 === 0 ? 'rgba(0,0,0,0.15)' : 'transparent',
                        borderRadius: 0.5,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </div>
          </div>

          {/* Clues list skeleton - hidden on small screens */}
          <div className="hidden md:block w-80">
            <Skeleton variant="text" width="40%" height={32} sx={{ marginBottom: 2 }} />
            <Stack spacing={1.5}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Box key={`across-${i}`}>
                  <Skeleton variant="text" width="90%" height={24} />
                </Box>
              ))}
            </Stack>
            <Skeleton
              variant="text"
              width="40%"
              height={32}
              sx={{ marginTop: 4, marginBottom: 2 }}
            />
            <Stack spacing={1.5}>
              {Array.from({ length: 6 }).map((_, i) => (
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

export default GameSkeleton;
