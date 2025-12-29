/**
 * Room Page Skeleton Loader
 * Shows a loading placeholder that mimics the room page layout
 */

import { Box, Skeleton, Stack } from '@mui/material';

const RoomSkeleton = () => {
  return (
    <div className="flex h-full w-full">
      {/* Sidebar skeleton */}
      <aside className="w-80 border-r border-gray-200 p-4 flex flex-col gap-4">
        {/* Room title */}
        <Box>
          <Skeleton variant="text" width="60%" height={32} />
        </Box>

        {/* User list */}
        <Box>
          <Skeleton variant="text" width="40%" height={24} sx={{ marginBottom: 2 }} />
          <Stack spacing={2}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="70%" height={20} />
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Room controls */}
        <Box sx={{ marginTop: 'auto' }}>
          <Skeleton variant="text" width="50%" height={24} sx={{ marginBottom: 2 }} />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={40}
            sx={{ borderRadius: 1, marginBottom: 2 }}
          />
          <Skeleton variant="rectangular" width="100%" height={36} sx={{ borderRadius: 1 }} />
        </Box>

        {/* Share section */}
        <Box>
          <Skeleton variant="text" width="50%" height={20} sx={{ marginBottom: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 1 }} />
        </Box>
      </aside>

      {/* Main content area skeleton */}
      <main className="flex-1 p-6 flex items-center justify-center">
        <Box
          sx={{
            width: '100%',
            maxWidth: 800,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Skeleton variant="text" width="50%" height={40} />
          <Skeleton variant="text" width="70%" height={24} />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={400}
            sx={{ borderRadius: 2, marginTop: 2 }}
          />
        </Box>
      </main>
    </div>
  );
};

export default RoomSkeleton;
