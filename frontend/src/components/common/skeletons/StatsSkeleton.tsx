/**
 * Stats Page Skeleton Loader
 * Shows a loading placeholder that mimics the stats page layout
 */

import { Box, Skeleton, Stack } from '@mui/material';

const StatsSkeleton = () => {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page title */}
      <Box>
        <Skeleton variant="text" width="30%" height={40} />
        <Skeleton variant="text" width="50%" height={24} sx={{ marginTop: 1 }} />
      </Box>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              padding: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Skeleton variant="text" width="60%" height={20} sx={{ marginBottom: 1 }} />
            <Skeleton variant="text" width="40%" height={36} />
          </Box>
        ))}
      </div>

      {/* Chart section */}
      <Box
        sx={{
          padding: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Skeleton variant="text" width="30%" height={32} sx={{ marginBottom: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 1 }} />
      </Box>

      {/* Another chart section */}
      <Box
        sx={{
          padding: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Skeleton variant="text" width="40%" height={32} sx={{ marginBottom: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={250} sx={{ borderRadius: 1 }} />
      </Box>

      {/* Table section */}
      <Box
        sx={{
          padding: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Skeleton variant="text" width="30%" height={32} sx={{ marginBottom: 2 }} />
        <Stack spacing={2}>
          {/* Table header */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              paddingBottom: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton variant="text" width="20%" height={24} />
            <Skeleton variant="text" width="20%" height={24} />
            <Skeleton variant="text" width="30%" height={24} />
          </Box>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2 }}>
              <Skeleton variant="text" width="30%" height={20} />
              <Skeleton variant="text" width="20%" height={20} />
              <Skeleton variant="text" width="20%" height={20} />
              <Skeleton variant="text" width="30%" height={20} />
            </Box>
          ))}
        </Stack>
      </Box>
    </div>
  );
};

export default StatsSkeleton;
