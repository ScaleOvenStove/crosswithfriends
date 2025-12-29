/**
 * List Skeleton Loader
 * Generic loading placeholder for list items
 */

import { Box, Skeleton, Stack } from '@mui/material';

interface ListSkeletonProps {
  count?: number;
  showThumbnail?: boolean;
}

const ListSkeleton = ({ count = 6, showThumbnail = false }: ListSkeletonProps) => {
  return (
    <div className="w-full">
      <Stack spacing={2}>
        {Array.from({ length: count }).map((_, i) => (
          <Box
            key={i}
            sx={{
              padding: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              gap: 2,
              alignItems: 'center',
            }}
          >
            {showThumbnail && (
              <Skeleton variant="rectangular" width={80} height={80} sx={{ borderRadius: 1 }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} sx={{ marginBottom: 1 }} />
              <Skeleton variant="text" width="80%" height={20} sx={{ marginBottom: 0.5 }} />
              <Skeleton variant="text" width="40%" height={18} />
            </Box>
            <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Stack>
    </div>
  );
};

export default ListSkeleton;
